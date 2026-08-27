package com.mentorly.payout;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mentorly.common.ApiResponse;
import com.mentorly.payment.WebhookEventRepository;
import com.mentorly.payment.WebhookEvent;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * REST controller for Razorpay Route / Linked Account mentor onboarding, payout status,
 * and payout webhook receiver.
 */
@RestController
@RequestMapping("/api/v1/mentor/razorpay-payout")
@RequiredArgsConstructor
public class RazorpayPayoutController {

    private static final Logger LOG = LoggerFactory.getLogger(RazorpayPayoutController.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RazorpayRouteService razorpayRouteService;
    private final WebhookEventRepository webhookEventRepository;

    /**
     * Create a Razorpay Linked Account (if needed) and return an onboarding URL.
     */
    @PostMapping("/onboard")
    public ApiResponse<Map<String, String>> onboard(@AuthenticationPrincipal User currentUser) {
        String onboardingUrl = razorpayRouteService.createOnboardingLink(currentUser);
        return new ApiResponse<>("Razorpay onboarding link created", Map.of("url", onboardingUrl));
    }

    /**
     * Get current onboarding/payout status for the logged-in mentor via Razorpay.
     */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> getStatus(@AuthenticationPrincipal User currentUser) {
        RazorpayLinkedAccount account = razorpayRouteService.createLinkedAccount(currentUser);
        return new ApiResponse<>("Razorpay payout status fetched", Map.of(
                "razorpayAccountId", account.getRazorpayAccountId(),
                "onboardingStatus", account.getOnboardingStatus().name(),
                "payoutsEnabled", account.isPayoutsEnabled(),
                "activated", account.isActivated()
        ));
    }

    /**
     * Razorpay payout webhook endpoint. Handles Route/transfer events.
     * Signature is verified using the payout-specific webhook secret.
     */
    @PostMapping("/webhook")
    public ApiResponse<String> handlePayoutWebhook(
            @RequestHeader(value = "x-razorpay-signature", required = false, defaultValue = "")
            String razorpaySignatureHeader,
            @RequestBody String rawBody) {

        // Verify signature with the payout webhook secret
        if (!razorpayRouteService.verifyWebhookSignature(rawBody, razorpaySignatureHeader)) {
            LOG.warn("Razorpay payout webhook signature verification FAILED — rejecting event");
            throw new IllegalArgumentException("Invalid webhook signature");
        }
        LOG.info("Razorpay payout webhook signature verified");

        // Parse payload
        Map<String, Object> payload;
        try {
            payload = OBJECT_MAPPER.readValue(rawBody, new TypeReference<>() { });
        } catch (Exception e) {
            LOG.warn("Failed to parse Razorpay payout webhook payload JSON", e);
            throw new IllegalArgumentException("Invalid webhook payload format");
        }

        // Extract event ID for deduplication
        String eventId = null;
        Object idObj = payload.get("id");
        if (idObj instanceof String s && s.startsWith("evt_")) {
            eventId = s;
        }

        // DB-backed deduplication
        if (eventId != null && !eventId.isBlank()) {
            if (webhookEventRepository.existsByGatewayAndEventId("razorpay-payout", eventId)) {
                LOG.info("Duplicate payout webhook event ignored: eventId={}", eventId);
                return new ApiResponse<>("Duplicate event acknowledged", "duplicate");
            }
            WebhookEvent event = new WebhookEvent();
            event.setGateway("razorpay-payout");
            event.setEventId(eventId);
            event.setReceivedAt(OffsetDateTime.now());
            try {
                webhookEventRepository.save(event);
            } catch (DataIntegrityViolationException e) {
                LOG.info("Duplicate payout webhook (race condition): eventId={}", eventId);
                return new ApiResponse<>("Duplicate event acknowledged", "duplicate");
            }
        }

        // Extract event type
        String eventType = payload.get("event") instanceof String s ? s : "unknown";
        LOG.info("Processing Razorpay payout webhook: eventType={}, eventId={}", eventType, eventId);

        // Extract the nested event data (transfer object)
        Object dataObj = payload.get("data");
        Map<String, Object> eventData = null;
        if (dataObj instanceof Map<?, ?> dataMap) {
            Object entityObj = dataMap.get("entity");
            if (entityObj instanceof Map<?, ?> entityMap) {
                @SuppressWarnings("unchecked")
                Map<String, Object> casted = (Map<String, Object>) entityMap;
                eventData = casted;
            }
        }

        // Also handle account.updated events (nested differently)
        if (eventData == null && dataObj instanceof Map<?, ?> dataMap) {
            Object paymentObj = dataMap.get("transfer");
            if (paymentObj instanceof Map<?, ?> transferMap) {
                Object entityObj = transferMap.get("entity");
                if (entityObj instanceof Map<?, ?> entityMap) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> casted = (Map<String, Object>) entityMap;
                    eventData = casted;
                }
            }
        }

        switch (eventType) {
            case "transfer.processed":
            case "transfer.paid":
                if (eventData != null) {
                    razorpayRouteService.handleTransferPaid(eventData);
                }
                break;
            case "transfer.failed":
                if (eventData != null) {
                    razorpayRouteService.handleTransferFailed(eventData);
                }
                break;
            case "account.updated":
                // Account events have the account entity at data.entity
                Object accountDataObj = payload.get("data");
                if (accountDataObj instanceof Map<?, ?> dm && dm.get("entity") instanceof Map<?, ?> entityMap) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> accountEvent = (Map<String, Object>) entityMap;
                    razorpayRouteService.handleAccountUpdated(accountEvent);
                }
                break;
            default:
                LOG.info("Ignoring unhandled Razorpay payout event: {}", eventType);
        }

        return new ApiResponse<>("Payout webhook processed", eventType);
    }
}
