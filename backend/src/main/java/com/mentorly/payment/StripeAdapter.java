package com.mentorly.payment;

import com.google.gson.JsonSyntaxException;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Adapter for the Stripe payment gateway — REAL integration.
 *
 * <p>Unlike the simulated Razorpay reference implementation, this adapter makes live Stripe API
 * calls using the official Stripe Java SDK. It is intended to run against
 * Stripe <b>test mode</b> keys: {@code PaymentIntent.create(...)} creates a
 * real PaymentIntent on Stripe's test infrastructure and
 * {@link #verifyWebhookSignature} performs genuine webhook signature
 * verification via {@code Webhook.constructEvent(...)}.
 *
 * <p>No key is hardcoded: the secret key and webhook secret come from
 * {@code STRIPE_SECRET_KEY} / {@code STRIPE_WEBHOOK_SECRET} (see
 * {@code app.payment.stripe.*} in application.yml and .env.example).
 */
@Component
public class StripeAdapter implements PaymentGateway {

    private static final Logger LOG = LoggerFactory.getLogger(StripeAdapter.class);

    private static final String DEFAULT_KEY_PLACEHOLDER = "sk_test_xxxxxxxxxxxx";
    private static final String DEFAULT_WEBHOOK_PLACEHOLDER = "whsec_test_secret";

    @Value("${app.payment.stripe.secret-key:" + DEFAULT_KEY_PLACEHOLDER + "}")
    private String secretKey;

    @Value("${app.payment.stripe.webhook-secret:" + DEFAULT_WEBHOOK_PLACEHOLDER + "}")
    private String webhookSecret;

    @PostConstruct
    void validateKeys() {
        boolean keyIsPlaceholder = secretKey == null || secretKey.isBlank()
                || DEFAULT_KEY_PLACEHOLDER.equals(secretKey);
        boolean webhookIsPlaceholder = webhookSecret == null || webhookSecret.isBlank()
                || DEFAULT_WEBHOOK_PLACEHOLDER.equals(webhookSecret);

        if (keyIsPlaceholder) {
            LOG.warn("⚠ Stripe secret-key is using the default/test placeholder! "
                    + "Set STRIPE_SECRET_KEY (test mode) in your .env — see dashboard.stripe.com "
                    + "→ Developers → API keys.");
        }
        if (webhookIsPlaceholder) {
            LOG.warn("⚠ Stripe webhook-secret is using the default/test placeholder! "
                    + "Set STRIPE_WEBHOOK_SECRET in your .env — see dashboard.stripe.com "
                    + "→ Developers → Webhooks, or use `stripe listen --print-secret`.");
        }

        // Stripe's Java SDK reads a static apiKey for every request. Only set it
        // when a real key is configured; otherwise calls fail with a clear
        // Stripe API authentication error rather than fabricating responses.
        // NOTE: this assumes a single Stripe account for the whole app — fine for
        // the current single-merchant deployment. If multi-tenant Stripe
        // accounts are ever needed, switch to per-request RequestOptions or a
        // StripeClient instance instead of the static global.
        if (!keyIsPlaceholder) {
            Stripe.apiKey = secretKey;
        }
    }

    @Override
    public Map<String, Object> createOrder(String orderId, BigDecimal amount, String currency) {
        try {
            // Stripe expects the amount in the smallest currency unit (e.g. paise
            // for INR, cents for USD) — two decimal places for the currencies
            // this platform uses. longValueExact() refuses silent rounding.
            long amountSmallestUnit = amount.movePointRight(2).longValueExact();

            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amountSmallestUnit)
                    .setCurrency(currency.toLowerCase(Locale.ROOT))
                    .putMetadata("internal_order_id", orderId)
                    .setAutomaticPaymentMethods(
                            PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                    .setEnabled(true)
                                    .build())
                    .build();

            // Real API call — creates an actual PaymentIntent on Stripe.
            PaymentIntent intent = PaymentIntent.create(params);

            Map<String, Object> response = new HashMap<>();
            response.put("id", intent.getId());
            response.put("object", "payment_intent");
            response.put("amount", intent.getAmount());
            response.put("currency", intent.getCurrency());
            response.put("status", intent.getStatus());
            response.put("client_secret", intent.getClientSecret());

            LOG.info("Stripe PaymentIntent created: orderId={}, stripePiId={}, amount={} {}, status={}",
                    orderId, intent.getId(), amount, currency, intent.getStatus());
            return response;
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException(
                    "Amount has more than 2 decimal places for Stripe: " + amount);
        } catch (StripeException e) {
            LOG.error("Stripe PaymentIntent.create failed for orderId={}", orderId, e);
            throw new IllegalStateException(
                    "Stripe payment intent creation failed: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean verifyPayment(String paymentId, String orderId, String signature,
            Map<String, String> extraParams) {
        try {
            // Real API call — retrieve the PaymentIntent and check its status.
            PaymentIntent intent = PaymentIntent.retrieve(paymentId);
            if (!"succeeded".equals(intent.getStatus())) {
                LOG.warn("Stripe verification failed: paymentId={}, status={}", paymentId, intent.getStatus());
                return false;
            }

            // SECURITY: Verify this PaymentIntent actually belongs to the expected order.
            // Without this check, a client could supply a PaymentIntent ID from a
            // different order/amount and pass verification.
            String intentOrderId = intent.getMetadata() != null
                    ? intent.getMetadata().get("internal_order_id") : null;
            if (orderId != null && !orderId.equals(intentOrderId)) {
                LOG.warn("Stripe verification REJECTED: paymentId={}, expected orderId={},"
                        + " but PaymentIntent belongs to orderId={}",
                        paymentId, orderId, intentOrderId);
                return false;
            }

            // SECURITY: Verify the payment amount matches the expected amount.
            // Prevents accepting a succeeded PaymentIntent for a different amount.
            if (extraParams != null && extraParams.containsKey("expectedAmountMinor")) {
                long expectedAmount = Long.parseLong(extraParams.get("expectedAmountMinor"));
                if (intent.getAmount() != expectedAmount) {
                    LOG.warn("Stripe verification REJECTED: paymentId={}, expected amount={},"
                            + " got amount={}", paymentId, expectedAmount, intent.getAmount());
                    return false;
                }
            }

            LOG.info("Stripe payment verification PASSED: paymentId={}, orderId={}, status={}",
                    paymentId, orderId, intent.getStatus());
            return true;
        } catch (StripeException e) {
            LOG.error("Stripe payment verification failed for paymentId={}", paymentId, e);
            return false;
        }
    }

    @Override
    public String processRefund(String paymentId, BigDecimal amount, String reason) {
        try {
            RefundCreateParams params = RefundCreateParams.builder()
                    .setPaymentIntent(paymentId)
                    .setAmount(amount.movePointRight(2).longValueExact())
                    .setReason(toRefundReason(reason))
                    .build();

            // Real API call — issues an actual refund on Stripe.
            Refund refund = Refund.create(params);
            LOG.info("Stripe refund created: paymentId={}, refundId={}, amount={}, reason={}",
                    paymentId, refund.getId(), amount, reason);
            return refund.getId();
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException(
                    "Amount has more than 2 decimal places for Stripe: " + amount);
        } catch (StripeException e) {
            LOG.error("Stripe refund failed for paymentId={}", paymentId, e);
            throw new IllegalStateException("Stripe refund failed: " + e.getMessage(), e);
        }
    }

    @Override
    public String fetchPaymentStatus(String paymentId) {
        try {
            PaymentIntent intent = PaymentIntent.retrieve(paymentId);
            return intent.getStatus();
        } catch (StripeException e) {
            LOG.error("Stripe payment status fetch failed for paymentId={}", paymentId, e);
            return null;
        }
    }

    @Override
    public boolean verifyWebhookSignature(String rawPayload, String signatureHeader) {
        // Early short-circuit: no payload or no signature header means there is
        // nothing to verify — never touch the Stripe SDK with garbage input.
        if (rawPayload == null || rawPayload.isBlank()
                || signatureHeader == null || signatureHeader.isBlank()) {
            LOG.warn("Stripe webhook payload or signature header missing or empty");
            return false;
        }
        try {
            // Real verification — computes and compares the HMAC-SHA256 signature
            // using the webhook secret, and enforces the timestamp tolerance.
            // (Note: stripe-java parses the JSON first, so a malformed body
            // surfaces as JsonSyntaxException — that must ALSO fail closed.)
            Webhook.constructEvent(rawPayload, signatureHeader, webhookSecret);
            LOG.info("Stripe webhook signature verification: PASSED");
            return true;
        } catch (SignatureVerificationException e) {
            // Real security check — never silently pass on failure.
            LOG.error("Stripe webhook signature verification FAILED: {}", e.getMessage());
            return false;
        } catch (JsonSyntaxException e) {
            // Malformed payload — constructEvent parses JSON before verifying,
            // so this path means the body is not valid JSON at all. Reject it
            // just as firmly as a bad signature (fail-closed).
            LOG.error("Stripe webhook payload is not valid JSON — rejecting event");
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

    private static RefundCreateParams.Reason toRefundReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return null;
        }
        String r = reason.toLowerCase(Locale.ROOT);
        if (r.contains("fraud")) {
            return RefundCreateParams.Reason.FRAUDULENT;
        }
        if (r.contains("duplicate")) {
            return RefundCreateParams.Reason.DUPLICATE;
        }
        return RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER;
    }
}
