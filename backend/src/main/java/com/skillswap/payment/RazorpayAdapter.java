package com.skillswap.payment;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.Map;

/**
 * Adapter for Razorpay payment gateway.
 * In production, this would use the Razorpay Java SDK.
 * The current implementation simulates API calls for development/testing.
 */
@Component
public class RazorpayAdapter implements PaymentGateway {

    private static final Logger LOG = LoggerFactory.getLogger(RazorpayAdapter.class);

    @Value("${app.payment.razorpay.key-id:rzp_test_xxxxxxxxxxxx}")
    private String keyId;

    @Value("${app.payment.razorpay.key-secret:rzp_test_secret}")
    private String keySecret;

    /**
     * When true (default off, must be enabled explicitly in prod/staging via
     * {@code APP_PAYMENT_RAZORPAY_FAIL_ON_PLACEHOLDER}), startup aborts if the
     * publicly-known placeholder keys are configured. The test secret
     * {@code rzp_test_secret} ships with the SDK docs and lets anyone forge
     * webhook signatures, so deploying with it is a critical misconfiguration.
     */
    @Value("${app.payment.razorpay.fail-on-placeholder:false}")
    private boolean failOnPlaceholder;

    @PostConstruct
    void validateKeys() {
        boolean idIsPlaceholder = keyId == null || keyId.isBlank()
                || "rzp_test_xxxxxxxxxxxx".equals(keyId);
        boolean secretIsPlaceholder = keySecret == null || keySecret.isBlank()
                || "rzp_test_secret".equals(keySecret);

        if (failOnPlaceholder && (idIsPlaceholder || secretIsPlaceholder)) {
            throw new IllegalStateException(
                    "Razorpay keys are using default/test placeholder values. "
                            + "Set APP_PAYMENT_RAZORPAY_KEY_ID and APP_PAYMENT_RAZORPAY_KEY_SECRET "
                            + "to real credentials before starting this profile.");
        }

        if (idIsPlaceholder) {
            LOG.warn("⚠ Razorpay key-id is using the default/test placeholder! "
                    + "Set APP_PAYMENT_RAZORPAY_KEY_ID in production.");
        }
        if (secretIsPlaceholder) {
            LOG.warn("⚠ Razorpay key-secret is using the default/test placeholder! "
                    + "Set APP_PAYMENT_RAZORPAY_KEY_SECRET in production.");
        }
    }

    @Override
    public Map<String, Object> createOrder(String orderId, BigDecimal amount, String currency) {
        // In production: use RazorpayClient.Orders.create()
        // Razorpay expects amount in paise (smallest currency unit)
        int amountPaise = amount.multiply(BigDecimal.valueOf(100)).intValue();

        Map<String, Object> response = new HashMap<>();
        response.put("id", "order_" + orderId);
        response.put("entity", "order");
        response.put("amount", amountPaise);
        response.put("amount_paid", 0);
        response.put("amount_due", amountPaise);
        response.put("currency", currency);
        response.put("receipt", orderId);
        response.put("status", "created");
        response.put("attempts", 0);
        response.put("notes", Map.of("internal_order_id", orderId));

        LOG.info("Razorpay order created: orderId={}, razorpayOrderId={}, amount={} {}",
                orderId, response.get("id"), amount, currency);

        return response;
    }

    @Override
    public boolean verifyPayment(String paymentId, String orderId, String signature,
            Map<String, String> extraParams) {
        try {
            // Razorpay signature verification: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
            String payload = orderId + "|" + paymentId;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(keySecret.getBytes("UTF-8"), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmacBytes = mac.doFinal(payload.getBytes("UTF-8"));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }

            String expectedSignature = hexString.toString();
            boolean verified = expectedSignature.equals(signature);

            LOG.info("Razorpay payment verification: paymentId={}, orderId={}, verified={}",
                    paymentId, orderId, verified);

            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            LOG.error("Razorpay signature verification failed", e);
            return false;
        }
    }

    @Override
    public String processRefund(String paymentId, BigDecimal amount, String reason) {
        // In production: use RazorpayClient.Payments.refund()
        String refundId = "rfnd_" + paymentId + "_" + System.currentTimeMillis();

        LOG.info("Razorpay refund processed: paymentId={}, amount={}, refundId={}, reason={}",
                paymentId, amount, refundId, reason);

        return refundId;
    }

    @Override
    public String fetchPaymentStatus(String paymentId) {
        // In production: use RazorpayClient.Payments.fetch()
        LOG.info("Razorpay payment status fetched: paymentId={}", paymentId);
        return "captured";
    }

    @Override
    public boolean verifyWebhookSignature(String rawPayload, String signatureHeader) {
        // Razorpay sends the signature in the "x-razorpay-signature" header.
        // The HMAC is computed over the raw request body using the key secret.
        if (rawPayload == null || signatureHeader == null || signatureHeader.isBlank()) {
            LOG.warn("Razorpay webhook signature header missing or empty");
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(keySecret.getBytes("UTF-8"), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmacBytes = mac.doFinal(rawPayload.getBytes("UTF-8"));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }

            String expectedSignature = hexString.toString();
            // Razorpay sends base64-encoded signatures, while our simulation uses hex.
            // Compare against both formats for compatibility.
            boolean verified = expectedSignature.equals(signatureHeader)
                    || java.util.Base64.getEncoder().encodeToString(
                            java.util.HexFormat.of().parseHex(expectedSignature))
                            .equals(signatureHeader);

            LOG.info("Razorpay webhook signature verification: {}", verified ? "PASSED" : "FAILED");
            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            LOG.error("Razorpay webhook signature verification failed", e);
            return false;
        }
    }

    @Override
    public String getGatewayName() {
        return "Razorpay";
    }

    @Override
    public String getGatewaySlug() {
        return "razorpay";
    }
}
