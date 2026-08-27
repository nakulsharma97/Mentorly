package com.mentorly.payment;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.google.gson.JsonSyntaxException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.slf4j.LoggerFactory;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
        // Mock succeeded intent with matching metadata
        PaymentIntent succeeded = mock(PaymentIntent.class);
        when(succeeded.getStatus()).thenReturn("succeeded");
        when(succeeded.getAmount()).thenReturn(10000L);
        when(succeeded.getMetadata()).thenReturn(Map.of("internal_order_id", "ORDER_X"));

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

    // ── Webhook signature verification: fail-closed edge cases ──

    private ListAppender<ILoggingEvent> logAppender;

    /**
     * Attaches a ListAppender to the StripeAdapter logger so tests can assert
     * the specific log statements emitted on the failure paths (a return value
     * alone doesn't prove the failure was actually logged).
     */
    private void attachLogCapture() {
        Logger logger = (Logger) LoggerFactory.getLogger(StripeAdapter.class);
        logAppender = new ListAppender<>();
        logAppender.start();
        logger.addAppender(logAppender);
    }

    @AfterEach
    void detachLogCapture() {
        if (logAppender != null) {
            ((Logger) LoggerFactory.getLogger(StripeAdapter.class)).detachAppender(logAppender);
            logAppender = null;
        }
    }

    private void assertErrorLogged(String messagePart) {
        List<ILoggingEvent> errorEvents = logAppender.list.stream()
                .filter(e -> e.getLevel() == Level.ERROR)
                .filter(e -> e.getFormattedMessage().contains(messagePart))
                .toList();
        assertFalse(errorEvents.isEmpty(),
                "Expected an ERROR log containing: " + messagePart
                        + " but none found. Logged events: " + logAppender.list);
    }

    @Test
    void verifyWebhookSignatureShortCircuitsOnNullOrBlankInputWithoutCallingSdk() {
        // A genuine short-circuit: with null/blank input the Stripe SDK must
        // never be touched. Open a static mock purely as an interaction
        // observer, then prove zero interactions happened.
        try (MockedStatic<Webhook> mocked = mockStatic(Webhook.class)) {
            assertFalse(adapter.verifyWebhookSignature(null, "t=1,v1=sig"));
            assertFalse(adapter.verifyWebhookSignature("", "t=1,v1=sig"));
            assertFalse(adapter.verifyWebhookSignature("   ", "t=1,v1=sig"));
            assertFalse(adapter.verifyWebhookSignature("{\"id\":\"evt_1\"}", null));
            assertFalse(adapter.verifyWebhookSignature("{\"id\":\"evt_1\"}", ""));

            mocked.verifyNoInteractions();
        }
    }

    @Test
    void verifyWebhookSignatureLogsErrorOnForgedSignature() {
        attachLogCapture();
        String payload = "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\"}";

        try (MockedStatic<Webhook> mocked = mockStatic(Webhook.class)) {
            // The SDK rejects the forged signature before returning an Event.
            mocked.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                    .thenThrow(new SignatureVerificationException(
                            "No signatures found matching the expected signature",
                            "t=1700000000,v1=forged"));

            assertFalse(adapter.verifyWebhookSignature(payload, "t=1700000000,v1=forged"));
        }

        // The failure must be visible in the logs — not silently swallowed.
        assertErrorLogged("FAILED");
    }

    @Test
    void verifyWebhookSignatureLogsErrorOnMalformedJsonPayload() {
        attachLogCapture();

        try (MockedStatic<Webhook> mocked = mockStatic(Webhook.class)) {
            // stripe-java parses JSON before checking the signature, so a
            // non-JSON body surfaces as JsonSyntaxException — the adapter must
            // fail closed (return false) and log it.
            mocked.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                    .thenThrow(new JsonSyntaxException("Malformed JSON at line 1"));

            assertFalse(adapter.verifyWebhookSignature("not-json-at-all", "t=1,v1=sig"));
        }

        assertErrorLogged("not valid JSON");
    }
}
