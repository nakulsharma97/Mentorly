package com.mentorly.payout;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mentorly.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Handles Stripe Connect webhook events — separate endpoint from the
 * regular payment webhooks because Connect events are signed with a
 * different webhook secret.
 */
@RestController
@RequestMapping("/api/v1/payments/webhook")
@RequiredArgsConstructor
public class ConnectWebhookController {

    private static final Logger LOG = LoggerFactory.getLogger(ConnectWebhookController.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final StripeConnectService stripeConnectService;

    /**
     * Stripe Connect webhook endpoint. Signature is verified using the
     * Connect-specific webhook secret (not the regular payment secret).
     */
    @PostMapping("/stripe-connect")
    public ApiResponse<String> handleConnectWebhook(
            @RequestHeader(value = "Stripe-Signature", required = false, defaultValue = "")
            String stripeSignatureHeader,
            @RequestBody String rawBody) {

        // Verify signature with Connect-specific secret
        if (!stripeConnectService.verifyConnectWebhookSignature(rawBody, stripeSignatureHeader)) {
            LOG.warn("Connect webhook signature verification FAILED — rejecting event");
            throw new IllegalArgumentException("Invalid webhook signature");
        }
        LOG.info("Connect webhook signature verified");

        // Parse payload
        Map<String, Object> payload;
        try {
            payload = OBJECT_MAPPER.readValue(rawBody, new TypeReference<>() { });
        } catch (Exception e) {
            LOG.warn("Failed to parse Connect webhook payload JSON", e);
            throw new IllegalArgumentException("Invalid webhook payload format");
        }

        String eventType = payload.get("type") instanceof String s ? s : "unknown";
        LOG.info("Processing Connect webhook: eventType={}", eventType);

        Object dataObj = payload.get("data");
        Map<String, Object> eventData = extractEventData(dataObj);

        switch (eventType) {
            case "account.updated" -> stripeConnectService.handleAccountUpdated(eventData);
            case "transfer.paid" -> stripeConnectService.handleTransferPaid(eventData);
            case "transfer.failed" -> stripeConnectService.handleTransferFailed(eventData);
            default -> LOG.info("Ignoring unhandled Connect event: {}", eventType);
        }

        return new ApiResponse<>("Connect webhook processed", eventType);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> extractEventData(Object dataObj) {
        if (!(dataObj instanceof Map<?, ?> dm)) {
            return null;
        }
        Object inner = dm.containsKey("object") ? dm.get("object") : dm;
        return inner instanceof Map ? (Map<String, Object>) inner : null;
    }
}
