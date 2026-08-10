package com.skillswap.payment;

import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the real Stripe integration. The Stripe SDK's static entry
 * points (PaymentIntent.create / retrieve, Refund.create) are mocked so no
 * real Stripe API is hit in CI — we assert the exact request shape the adapter
 * builds. Webhook signature tests sign the payload with the SDK's own
 * HMAC-SHA256 util ({@code Webhook.Util.computeHmacSha256}) so the
 * verification logic runs against genuinely signed events.
 */
class StripeAdapterTest {

    private static final String TEST_WEBHOOK_SECRET = "whsec_test_123";

    private StripeAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new StripeAdapter();
        ReflectionTestUtils.setField(adapter, "secretKey", "sk_test_abc");
        ReflectionTestUtils.setField(adapter, "webhookSecret", TEST_WEBHOOK_SECRET);
    }

    @Test
    void createOrderBuildsCorrectPaymentIntentRequestShape() throws Exception {
        PaymentIntent intent = mock(PaymentIntent.class);
        when(intent.getId()).thenReturn("pi_mock_123");
        when(intent.getClientSecret()).thenReturn("pi_mock_123_secret_x");
        when(intent.getStatus()).thenReturn("requires_payment_method");
        when(intent.getAmount()).thenReturn(1250L);
        when(intent.getCurrency()).thenReturn("inr");

        ArgumentCaptor<PaymentIntentCreateParams> captor =
                ArgumentCaptor.forClass(PaymentIntentCreateParams.class);

        try (MockedStatic<PaymentIntent> mocked = mockStatic(PaymentIntent.class)) {
            mocked.when(() -> PaymentIntent.create(captor.capture())).thenReturn(intent);

            Map<String, Object> response = adapter.createOrder(
                    "ORDER_TEST", new BigDecimal("12.50"), "INR");

            // Request shape — amount converted to smallest currency unit (paise),
            // currency lowercased, internal order id attached as metadata
            PaymentIntentCreateParams params = captor.getValue();
            assertEquals(1250L, params.getAmount());
            assertEquals("inr", params.getCurrency());
            assertEquals("ORDER_TEST", params.getMetadata().get("internal_order_id"));

            // Response carries the REAL Stripe id + client_secret, not a fabricated one
            assertEquals("pi_mock_123", response.get("id"));
            assertEquals("pi_mock_123_secret_x", response.get("client_secret"));
            assertEquals("requires_payment_method", response.get("status"));
        }
    }

    @Test
    void createOrderRejectsMoreThanTwoDecimalPlaces() {
        try (MockedStatic<PaymentIntent> mocked = mockStatic(PaymentIntent.class)) {
            assertThrows(IllegalArgumentException.class,
                    () -> adapter.createOrder("ORDER_X", new BigDecimal("12.345"), "INR"));
            mocked.verifyNoInteractions();
        }
    }

    @Test
    void verifyPaymentRetrievesIntentAndChecksSucceededStatus() throws Exception {
        PaymentIntent succeeded = mock(PaymentIntent.class);
        when(succeeded.getStatus()).thenReturn("succeeded");
        PaymentIntent pending = mock(PaymentIntent.class);
        when(pending.getStatus()).thenReturn("requires_payment_method");

        try (MockedStatic<PaymentIntent> mocked = mockStatic(PaymentIntent.class)) {
            mocked.when(() -> PaymentIntent.retrieve("pi_paid")).thenReturn(succeeded);
            mocked.when(() -> PaymentIntent.retrieve("pi_pending")).thenReturn(pending);

            assertTrue(adapter.verifyPayment("pi_paid", "ORDER_X", "sig", Map.of()));
            assertFalse(adapter.verifyPayment("pi_pending", "ORDER_X", "sig", Map.of()));
        }
    }

    @Test
    void processRefundBuildsCorrectRequestAndReturnsRealRefundId() throws Exception {
        Refund refund = mock(Refund.class);
        when(refund.getId()).thenReturn("re_mock_1");

        ArgumentCaptor<RefundCreateParams> captor =
                ArgumentCaptor.forClass(RefundCreateParams.class);

        try (MockedStatic<Refund> mocked = mockStatic(Refund.class)) {
            mocked.when(() -> Refund.create(captor.capture())).thenReturn(refund);

            String refundId = adapter.processRefund(
                    "pi_mock_123", new BigDecimal("12.50"), "Customer requested");

            RefundCreateParams params = captor.getValue();
            assertEquals("pi_mock_123", params.getPaymentIntent());
            assertEquals(1250L, params.getAmount());
            assertEquals(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER, params.getReason());
            assertEquals("re_mock_1", refundId);
        }
    }

    // ── Webhook signature verification (real SDK, no network) ──

    /**
     * Builds a real Stripe-Signature header for the given payload + secret,
     * exactly as Stripe's own tests do: the signed content is
     * {@code "<timestamp>.<payload>"}, HMAC-SHA256'd with the webhook secret.
     * Uses the SDK's public {@link Webhook.Util#computeHmacSha256} so the
     * signature scheme matches production verification bit-for-bit.
     */
    private static String signedHeader(String payload, String secret) {
        long timestamp = System.currentTimeMillis() / 1000;
        String signedPayload = timestamp + "." + payload;
        try {
            // Note: SDK signature is computeHmacSha256(secret, signedPayload).
            String hmac = Webhook.Util.computeHmacSha256(secret, signedPayload);
            return "t=" + timestamp + ",v1=" + hmac;
        } catch (Exception e) {
            throw new IllegalStateException("Could not sign test payload", e);
        }
    }

    @Test
    void verifyWebhookSignatureAcceptsValidSignedEvent() {
        String payload = "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\"}";
        String header = signedHeader(payload, TEST_WEBHOOK_SECRET);
        assertTrue(adapter.verifyWebhookSignature(payload, header));
    }

    @Test
    void verifyWebhookSignatureRejectsTamperedPayload() {
        String payload = "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\"}";
        String header = signedHeader(payload, TEST_WEBHOOK_SECRET);
        // Same shape, different content — keeps the payload valid JSON so this
        // exercises the real HMAC mismatch path (not the JSON-parse path).
        String tampered = "{\"id\":\"evt_999\",\"type\":\"payment_intent.succeeded\"}";
        assertFalse(adapter.verifyWebhookSignature(tampered, header));
    }

    @Test
    void verifyWebhookSignatureRejectsMalformedJsonPayload() {
        // stripe-java parses JSON before verifying, so a non-JSON body must
        // fail closed too (JsonSyntaxException caught inside the adapter).
        String payload = "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\"}";
        String header = signedHeader(payload, TEST_WEBHOOK_SECRET);
        assertFalse(adapter.verifyWebhookSignature("not-json-at-all", header));
    }

    @Test
    void verifyWebhookSignatureRejectsWrongSecret() {
        String payload = "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\"}";
        String header = signedHeader(payload, "whsec_wrong");
        assertFalse(adapter.verifyWebhookSignature(payload, header));
    }

    @Test
    void verifyWebhookSignatureRejectsMissingHeader() {
        String payload = "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\"}";
        assertFalse(adapter.verifyWebhookSignature(payload, ""));
        assertFalse(adapter.verifyWebhookSignature(payload, null));
    }
}
