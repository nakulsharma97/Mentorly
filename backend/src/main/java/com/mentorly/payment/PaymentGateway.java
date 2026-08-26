package com.mentorly.payment;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Strategy interface for payment gateway adapters.
 * Each implementation (Razorpay, Stripe, PayPal) provides its own
 * logic for creating orders, verifying payments, and processing refunds.
 */
public interface PaymentGateway {

    /**
     * Create a payment order on the gateway side.
     *
     * @param orderId  Internal unique order reference
     * @param amount   Payment amount
     * @param currency Currency code (e.g. INR, USD)
     * @return Map containing gateway-specific response fields (e.g. razorpay_order_id, amount, currency)
     */
    Map<String, Object> createOrder(String orderId, BigDecimal amount, String currency);

    /**
     * Verify payment authenticity using gateway-specific signature/hmac.
     *
     * @param paymentId    Gateway payment ID
     * @param orderId      Internal order reference
     * @param signature    Signature string from gateway callback
     * @param extraParams  Additional gateway-specific verification data
     * @return true if verification succeeds
     */
    boolean verifyPayment(String paymentId, String orderId, String signature, Map<String, String> extraParams);

    /**
     * Process a refund for the given payment.
     *
     * @param paymentId Gateway payment ID
     * @param amount    Amount to refund
     * @param reason    Reason for refund
     * @return Gateway refund reference ID
     */
    String processRefund(String paymentId, BigDecimal amount, String reason);

    /**
     * Fetch the current status of a payment from the gateway.
     *
     * @param paymentId Gateway payment ID
     * @return Current payment status string from the gateway
     */
    String fetchPaymentStatus(String paymentId);

    /**
     * Human-readable name of this gateway.
     */
    String getGatewayName();

    /**
     * Unique slug identifier for this gateway (e.g. "razorpay", "stripe", "paypal").
     */
    String getGatewaySlug();

    /**
     * Verify the authenticity of a webhook event using the gateway-specific
     * signature scheme (HMAC, webhook secret, or API-based verification).
     *
     * <p>Each gateway verifies differently:
     * <ul>
     *   <li><b>Stripe:</b> HMAC-SHA256 over the raw payload using the webhook secret</li>
     *   <li><b>Razorpay:</b> HMAC-SHA256 of {@code order_id|payment_id} using the key secret</li>
     *   <li><b>PayPal:</b> HMAC-SHA256 over the raw payload using the client secret</li>
     * </ul>
     *
     * @param rawPayload     The raw request body as received from the gateway
     * @param signatureHeader Value of the webhook signature header
     *                        (e.g. {@code Stripe-Signature}, {@code x-razorpay-signature})
     * @return true if the signature is valid and the payload is authentic
     */
    boolean verifyWebhookSignature(String rawPayload, String signatureHeader);
}
