package com.mentorly.payment;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.Map;

/**
 * Adapter for PayPal payment gateway.
 * In production, this would use the PayPal Java SDK (Checkout-API).
 * The current implementation simulates API calls for development/testing.
 */
@Component
public class PayPalAdapter implements PaymentGateway {

    private static final Logger LOG = LoggerFactory.getLogger(PayPalAdapter.class);

    @Value("${app.payment.paypal.client-id:test_client_id}")
    private String clientId;

    @Value("${app.payment.paypal.client-secret:test_client_secret}")
    private String clientSecret;

    @PostConstruct
    void validateKeys() {
        if (clientId == null || clientId.isBlank()
                || "test_client_id".equals(clientId)) {
            LOG.warn("⚠ PayPal client-id is using the default/test placeholder! "
                    + "Set APP_PAYMENT_PAYPAL_CLIENT_ID in production.");
        }
        if (clientSecret == null || clientSecret.isBlank()
                || "test_client_secret".equals(clientSecret)) {
            LOG.warn("⚠ PayPal client-secret is using the default/test placeholder! "
                    + "Set APP_PAYMENT_PAYPAL_CLIENT_SECRET in production.");
        }
    }

    @Override
    public Map<String, Object> createOrder(String orderId, BigDecimal amount, String currency) {
        // In production: use PayPal Orders API
        Map<String, Object> response = new HashMap<>();
        response.put("id", "PAYPAL_ORDER_" + orderId);
        response.put("status", "CREATED");
        response.put("intent", "CAPTURE");
        response.put("purchase_units", java.util.List.of(Map.of(
                "reference_id", orderId,
                "amount", Map.of(
                        "currency_code", currency,
                        "value", amount.setScale(2, RoundingMode.HALF_UP).toString()
                )
        )));
        response.put("create_time", java.time.OffsetDateTime.now().toString());
        response.put("links", java.util.List.of(
                Map.of("href", "https://www.paypal.com/checkout?token=" + orderId,
                        "rel", "approve",
                        "method", "GET")
        ));

        LOG.info("PayPal order created: orderId={}, paypalOrderId={}, amount={} {}",
                orderId, response.get("id"), amount, currency);

        return response;
    }

    @Override
    public boolean verifyPayment(String paymentId, String orderId, String signature,
            Map<String, String> extraParams) {
        // PayPal uses webhook verification with webhook_id
        try {
            String payload = orderId + "|" + paymentId + "|" + System.currentTimeMillis();
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(clientSecret.getBytes("UTF-8"), "HmacSHA256");
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

            LOG.info("PayPal payment verification: paymentId={}, orderId={}, verified={}",
                    paymentId, orderId, verified);

            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            LOG.error("PayPal signature verification failed", e);
            return false;
        }
    }

    @Override
    public String processRefund(String paymentId, BigDecimal amount, String reason) {
        // In production: use PayPal Capture API refund()
        String refundId = "PAYPAL_REFUND_" + paymentId + "_" + System.currentTimeMillis();

        LOG.info("PayPal refund processed: paymentId={}, amount={}, refundId={}, reason={}",
                paymentId, amount, refundId, reason);

        return refundId;
    }

    @Override
    public String fetchPaymentStatus(String paymentId) {
        // In production: use PayPal Orders API getOrder()
        LOG.info("PayPal payment status fetched: paymentId={}", paymentId);
        return "COMPLETED";
    }

    @Override
    public boolean verifyWebhookSignature(String rawPayload, String signatureHeader) {
        // PayPal uses a webhook verification API (POST /v1/notifications/verify-webhook-signature)
        // with the webhook ID, the raw payload, and headers.
        // In this simulation, we use HMAC-SHA256 with the client secret as a simplified check.
        if (rawPayload == null || signatureHeader == null || signatureHeader.isBlank()) {
            LOG.warn("PayPal webhook signature header missing or empty");
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(clientSecret.getBytes("UTF-8"), "HmacSHA256");
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

            boolean verified = hexString.toString().equals(signatureHeader);
            // In production: call PayPal's /v1/notifications/verify-webhook-signature
            LOG.info("PayPal webhook signature verification: {}", verified ? "PASSED" : "FAILED");
            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            LOG.error("PayPal webhook signature verification failed", e);
            return false;
        }
    }

    @Override
    public String getGatewayName() {
        return "PayPal";
    }

    @Override
    public String getGatewaySlug() {
        return "paypal";
    }
}
