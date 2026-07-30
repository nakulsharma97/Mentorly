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
 * Adapter for Stripe payment gateway.
 * In production, this would use the Stripe Java SDK.
 * The current implementation simulates API calls for development/testing.
 */
@Component
public class StripeAdapter implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeAdapter.class);

    @Value("${app.payment.stripe.secret-key:sk_test_xxxxxxxxxxxx}")
    private String secretKey;

    @Value("${app.payment.stripe.webhook-secret:whsec_test_secret}")
    private String webhookSecret;

    @PostConstruct
    void validateKeys() {
        if (secretKey == null || secretKey.isBlank()
                || "sk_test_xxxxxxxxxxxx".equals(secretKey)) {
            log.warn("⚠ Stripe secret-key is using the default/test placeholder! "
                    + "Set APP_PAYMENT_STRIPE_SECRET_KEY in production.");
        }
        if (webhookSecret == null || webhookSecret.isBlank()
                || "whsec_test_secret".equals(webhookSecret)) {
            log.warn("⚠ Stripe webhook-secret is using the default/test placeholder! "
                    + "Set APP_PAYMENT_STRIPE_WEBHOOK_SECRET in production.");
        }
    }

    @Override
    public Map<String, Object> createOrder(String orderId, BigDecimal amount, String currency) {
        // In production: use Stripe API PaymentIntent.create()
        // Stripe expects amount in cents (smallest currency unit)
        int amountCents = amount.multiply(BigDecimal.valueOf(100)).intValue();

        Map<String, Object> response = new HashMap<>();
        response.put("id", "pi_" + orderId);
        response.put("object", "payment_intent");
        response.put("amount", amountCents);
        response.put("amount_capturable", 0);
        response.put("amount_received", 0);
        response.put("currency", currency.toLowerCase());
        response.put("status", "requires_payment_method");
        response.put("client_secret", "pi_" + orderId + "_secret_" + System.currentTimeMillis());

        log.info("Stripe payment intent created: orderId={}, stripePiId={}, amount={} {}",
                orderId, response.get("id"), amount, currency);

        return response;
    }

    @Override
    public boolean verifyPayment(String paymentId, String orderId, String signature,
            Map<String, String> extraParams) {
        // Stripe uses webhook signature verification with the webhook secret
        // In production: use Stripe's Webhook.constructEvent()
        try {
            String payload = orderId + "|" + paymentId + "|" + System.currentTimeMillis();
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(webhookSecret.getBytes("UTF-8"), "HmacSHA256");
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

            log.info("Stripe payment verification: paymentId={}, orderId={}, verified={}",
                    paymentId, orderId, verified);

            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            log.error("Stripe signature verification failed", e);
            return false;
        }
    }

    @Override
    public String processRefund(String paymentId, BigDecimal amount, String reason) {
        // In production: use Stripe API Refund.create()
        String refundId = "re_" + paymentId + "_" + System.currentTimeMillis();

        log.info("Stripe refund processed: paymentId={}, amount={}, refundId={}, reason={}",
                paymentId, amount, refundId, reason);

        return refundId;
    }

    @Override
    public String fetchPaymentStatus(String paymentId) {
        // In production: use Stripe API PaymentIntent.retrieve()
        log.info("Stripe payment status fetched: paymentId={}", paymentId);
        return "succeeded";
    }

    @Override
    public boolean verifyWebhookSignature(String rawPayload, String signatureHeader) {
        // Stripe sends signatures in the "Stripe-Signature" header as:
        //   t=timestamp,v1=signature1,v1=signature2,...
        // We parse the v1 signature and verify against the raw payload.
        if (rawPayload == null || signatureHeader == null || signatureHeader.isBlank()) {
            log.warn("Stripe webhook signature header missing or empty");
            return false;
        }
        try {
            // Parse the v1 signature from the header
            String v1Signature = null;
            for (String part : signatureHeader.split(",")) {
                String trimmed = part.trim();
                if (trimmed.startsWith("v1=")) {
                    v1Signature = trimmed.substring(3);
                    break;
                }
            }
            if (v1Signature == null || v1Signature.isBlank()) {
                log.warn("No v1 signature found in Stripe-Signature header");
                return false;
            }

            // Compute expected HMAC-SHA256 of the raw payload
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(webhookSecret.getBytes("UTF-8"), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmacBytes = mac.doFinal(rawPayload.getBytes("UTF-8"));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }

            boolean verified = hexString.toString().equals(v1Signature);
            log.info("Stripe webhook signature verification: {}", verified ? "PASSED" : "FAILED");
            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            log.error("Stripe webhook signature verification failed", e);
            return false;
        }
    }

    @Override
    public String getGatewayName() {
        return "Stripe";
    }

    @Override
    public String getGatewaySlug() {
        return "stripe";
    }
}
