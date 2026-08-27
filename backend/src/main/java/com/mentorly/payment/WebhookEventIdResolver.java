package com.mentorly.payment;

import java.util.Map;

/**
 * Shared utility for extracting webhook event IDs from Razorpay requests.
 * <p>
 * Razorpay sends the canonical event ID in the {@code X-Razorpay-Event-Id}
 * header, which is the most reliable source. The payload's top-level {@code "id"}
 * field is a fallback but is not guaranteed to be a stable/unique event
 * identifier the same way the header is.
 * <p>
 * This utility is used by both the payment webhook handler
 * ({@code PaymentController}) and the payout webhook handler
 * ({@code RazorpayPayoutController}) so any future improvement to event-id
 * derivation applies consistently everywhere.
 */
public final class WebhookEventIdResolver {

    private WebhookEventIdResolver() { }

    /**
     * Resolve the durable event ID for deduplication.
     *
     * @param headerEventId value of the {@code X-Razorpay-Event-Id} header (may be null/blank)
     * @param payload       parsed webhook JSON payload
     * @return the resolved event ID, or null if none could be determined
     */
    public static String resolve(String headerEventId, Map<String, Object> payload) {
        // Prefer the header — it is Razorpay's canonical, stable event identifier
        if (headerEventId != null && !headerEventId.isBlank()) {
            return headerEventId.trim();
        }

        // Fallback: top-level "id" field in the payload
        if (payload != null) {
            Object idObj = payload.get("id");
            if (idObj instanceof String s && !s.isBlank()) {
                return s;
            }
        }

        return null;
    }
}
