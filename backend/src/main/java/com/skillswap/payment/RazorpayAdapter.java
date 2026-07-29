package com.skillswap.payment;

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

    private static final Logger log = LoggerFactory.getLogger(RazorpayAdapter.class);

    @Value("${app.payment.razorpay.key-id:rzp_test_xxxxxxxxxxxx}")
    private String keyId;

    @Value("${app.payment.razorpay.key-secret:rzp_test_secret}")
    private String keySecret;

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

        log.info("Razorpay order created: orderId={}, razorpayOrderId={}, amount={} {}",
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

            log.info("Razorpay payment verification: paymentId={}, orderId={}, verified={}",
                    paymentId, orderId, verified);

            return verified;
        } catch (GeneralSecurityException | java.io.UnsupportedEncodingException e) {
            log.error("Razorpay signature verification failed", e);
            return false;
        }
    }

    @Override
    public String processRefund(String paymentId, BigDecimal amount, String reason) {
        // In production: use RazorpayClient.Payments.refund()
        String refundId = "rfnd_" + paymentId + "_" + System.currentTimeMillis();

        log.info("Razorpay refund processed: paymentId={}, amount={}, refundId={}, reason={}",
                paymentId, amount, refundId, reason);

        return refundId;
    }

    @Override
    public String fetchPaymentStatus(String paymentId) {
        // In production: use RazorpayClient.Payments.fetch()
        log.info("Razorpay payment status fetched: paymentId={}", paymentId);
        return "captured";
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
