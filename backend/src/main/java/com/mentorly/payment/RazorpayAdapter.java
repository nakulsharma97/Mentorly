package com.mentorly.payment;

import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Refund;
import jakarta.annotation.PostConstruct;
import org.json.JSONObject;
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
 * Adapter for Razorpay payment gateway — REAL integration.
 *
 * <p>Unlike the previous simulation, this adapter makes live Razorpay API
 * calls using the official Razorpay Java SDK. It is intended to run against
 * Razorpay test mode keys: {@code Payments.refund()} creates a real refund
 * on Razorpay's test infrastructure and {@link #verifyWebhookSignature}
 * performs genuine webhook signature verification.
 *
 * <p>No key is hardcoded: the key ID and key secret come from
 * {@code APP_PAYMENT_RAZORPAY_KEY_ID} / {@code APP_PAYMENT_RAZORPAY_KEY_SECRET}
 * (see {@code app.payment.razorpay.*} in application.yml and .env.example).
 */
@Component
public class RazorpayAdapter implements PaymentGateway {

    private static final Logger LOG = LoggerFactory.getLogger(RazorpayAdapter.class);

    @Value("${app.payment.razorpay.key-id:rzp_test_xxxxxxxxxxxx}")
    private String keyId;

    @Value("${app.payment.razorpay.key-secret:rzp_test_secret}")
    private String keySecret;

    private RazorpayClient razorpayClient;

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

        // Initialize the real Razorpay client only with real keys.
        // Placeholder keys mean the SDK would fail on every call, so skip
        // initialization — the adapter will throw a clear error if anyone
        // tries to use it without real credentials.
        if (!idIsPlaceholder && !secretIsPlaceholder) {
            try {
                razorpayClient = new RazorpayClient(keyId, keySecret);
                LOG.info("Razorpay SDK initialized successfully");
            } catch (RazorpayException e) {
                LOG.error("Failed to initialize Razorpay SDK", e);
                throw new IllegalStateException("Razorpay SDK initialization failed: " + e.getMessage(), e);
            }
        } else {
            LOG.warn("Razorpay SDK NOT initialized — using placeholder keys. "
                    + "Refund API calls will fail.");
        }
    }

    @Override
    public Map<String, Object> createOrder(String orderId, BigDecimal amount, String currency) {
        if (razorpayClient == null) {
            throw new IllegalStateException(
                    "Razorpay SDK not initialized — set real APP_PAYMENT_RAZORPAY_KEY_ID "
                            + "and APP_PAYMENT_RAZORPAY_KEY_SECRET environment variables.");
        }

        try {
            // Razorpay expects amount in paise (smallest currency unit)
            int amountPaise = amount.multiply(BigDecimal.valueOf(100)).intValue();

            // Build the real Razorpay Orders API request
            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountPaise);
            orderRequest.put("currency", currency);
            orderRequest.put("receipt", orderId);
            orderRequest.put("notes", new JSONObject().put("internal_order_id", orderId));

            // Real API call — creates an actual Razorpay Order
            com.razorpay.Order order = razorpayClient.orders.create(orderRequest);

            Map<String, Object> response = new HashMap<>();
            response.put("id", order.get("id"));           // e.g. order_PAblzC2xcNwKA2
            response.put("entity", "order");
            response.put("amount", order.get("amount"));
            response.put("amount_paid", order.get("amount_paid"));
            response.put("amount_due", order.get("amount_due"));
            response.put("currency", order.get("currency"));
            response.put("receipt", order.get("receipt"));
            response.put("status", order.get("status"));
            response.put("attempts", order.get("attempts"));

            LOG.info("Razorpay order created: internalOrderId={}, razorpayOrderId={}, amount={} {}",
                    orderId, response.get("id"), amount, currency);

            return response;
        } catch (RazorpayException e) {
            LOG.error("Razorpay order creation failed for orderId={}: {}", orderId, e.getMessage(), e);
            throw new IllegalStateException("Razorpay order creation failed: " + e.getMessage(), e);
        }
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
        if (razorpayClient == null) {
            throw new IllegalStateException(
                    "Razorpay SDK not initialized — set real APP_PAYMENT_RAZORPAY_KEY_ID "
                            + "and APP_PAYMENT_RAZORPAY_KEY_SECRET environment variables.");
        }

        try {
            // Razorpay expects amount in paise (smallest currency unit).
            int amountPaise = amount.multiply(BigDecimal.valueOf(100)).intValue();

            JSONObject refundRequest = new JSONObject();
            refundRequest.put("payment_id", paymentId);
            refundRequest.put("amount", amountPaise);
            if (reason != null && !reason.isBlank()) {
                refundRequest.put("notes", new JSONObject().put("reason", reason));
            }

            // Real API call — creates an actual refund on Razorpay.
            Refund refund = razorpayClient.payments.refund(refundRequest);
            String refundId = refund.get("id");

            LOG.info("Razorpay refund created: paymentId={}, refundId={}, amount={} paise, reason={}",
                    paymentId, refundId, amountPaise, reason);

            return refundId;
        } catch (RazorpayException e) {
            LOG.error("Razorpay refund failed for paymentId={}: {}", paymentId, e.getMessage(), e);
            throw new IllegalStateException("Razorpay refund failed: " + e.getMessage(), e);
        }
    }

    @Override
    public String fetchPaymentStatus(String paymentId) {
        if (razorpayClient == null) {
            LOG.warn("Razorpay SDK not initialized — cannot fetch payment status");
            return null;
        }
        try {
            com.razorpay.Payment payment = razorpayClient.payments.fetch(paymentId);
            String status = payment.get("status");
            LOG.info("Razorpay payment status fetched: paymentId={}, status={}", paymentId, status);
            return status;
        } catch (RazorpayException e) {
            LOG.error("Razorpay payment status fetch failed for paymentId={}: {}", paymentId, e.getMessage());
            return null;
        }
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
