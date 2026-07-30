package com.skillswap.payment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Tag(name = "Payments", description = "Payment processing, gateway adapters, refunds, and transaction history")
@RestController
@Validated
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    private final PaymentService paymentService;
    private final PaymentVerificationService paymentVerificationService;
    private final PaymentRepository paymentRepository;

    /**
     * Get payment history for the current user.
     */
    @GetMapping
    public ApiResponse<List<Payment>> history(@AuthenticationPrincipal User currentUser) {
        List<Payment> payments = paymentService.getPaymentHistory(currentUser);
        return new ApiResponse<>("Payments fetched", payments);
    }

    /**
     * Get a specific payment by ID.
     */
    @GetMapping("/{id}")
    public ApiResponse<Payment> getPayment(@AuthenticationPrincipal User currentUser,
            @PathVariable @NotNull @Min(1) Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        return new ApiResponse<>("Payment fetched", payment);
    }

    /**
     * Create a payment order/intent via the specified gateway adapter.
     * Body can include: { "bookingId": Long, "amount": BigDecimal, "gateway": "razorpay"|"stripe"|"paypal" }
     */
    @PostMapping("/intent")
    public ApiResponse<Payment> createIntent(@AuthenticationPrincipal User currentUser,
            @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
            @Valid @RequestBody CreatePaymentIntentRequest req) {
        String gateway = req.gateway() != null && !req.gateway().isBlank() ? req.gateway() : "razorpay";
        Payment payment = paymentService.createPaymentOrder(currentUser, idempotencyKey,
                req.bookingId(), req.amount(), gateway);
        return new ApiResponse<>("Payment intent created", payment);
    }

    /**
     * Verify a payment after gateway callback/redirect.
     */
    @PostMapping("/verify")
    public ApiResponse<Payment> verifyPayment(@AuthenticationPrincipal User currentUser,
            @Valid @RequestBody VerifyPaymentRequest req) {
        Payment verified = paymentVerificationService.verifyPayment(
                req.paymentId(), req.gatewayPaymentId(), req.signature(), req.extraParams());
        return new ApiResponse<>("Payment verified", verified);
    }

    /**
     * Poll the gateway for the current status of a payment.
     * Useful for retrying after a timeout or network error.
     */
    @GetMapping("/{id}/status")
    public ApiResponse<Payment> getPaymentStatus(@AuthenticationPrincipal User currentUser,
            @PathVariable @NotNull @Min(1) Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));

        // Only the learner or admin can poll
        boolean isLearner = payment.getLearnerId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole().name().equals("ADMIN");
        if (!isLearner && !isAdmin) {
            throw new IllegalArgumentException("Not authorized to check this payment");
        }

        // If the payment is stuck in INITIATED, try fetching from the gateway
        if (payment.getStatus() == PaymentStatus.INITIATED && payment.getPaymentId() != null) {
            try {
                String gatewayStatus = paymentVerificationService.fetchFromGateway(payment);
                if ("captured".equalsIgnoreCase(gatewayStatus) || "completed".equalsIgnoreCase(gatewayStatus)) {
                    // Complete the verification
                    payment = paymentVerificationService.verifyPayment(
                            payment.getId(), payment.getPaymentId(), payment.getSignature(), Map.of());
                }
            } catch (Exception e) {
                log.warn("Failed to fetch gateway status for paymentId={}", id, e);
            }
        }

        return new ApiResponse<>("Payment status fetched", payment);
    }

    /**
     * Process a refund for a payment.
     */
    @PostMapping("/{id}/refund")
    public ApiResponse<Payment> refundPayment(@AuthenticationPrincipal User currentUser,
            @PathVariable @NotNull @Min(1) Long id,
            @Valid @RequestBody RefundPaymentRequest req) {
        Payment refunded = paymentService.refundPayment(id, req.amount(), req.reason());
        return new ApiResponse<>("Refund processed", refunded);
    }

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /**
     * Process a gateway webhook event.
     *
     * <p>Verifies the webhook signature using the gateway's adapter before
     * processing the payload. The raw request body is consumed as a String to
     * preserve the exact bytes for HMAC verification.
     */
    @PostMapping("/webhook/{gateway}")
    public ApiResponse<Payment> handleWebhook(
            @PathVariable @NotBlank String gateway,
            @RequestHeader(value = "X-Webhook-Signature", required = false, defaultValue = "") String signatureHeader,
            @RequestBody String rawBody) {

        // Resolve the gateway adapter for this webhook
        PaymentGateway gatewayAdapter = paymentService.resolveGateway(gateway);

        // Verify webhook signature — reject forged events before any processing
        if (!gatewayAdapter.verifyWebhookSignature(rawBody, signatureHeader)) {
            log.warn("Webhook signature verification FAILED for gateway={}", gateway);
            throw new IllegalArgumentException("Invalid webhook signature");
        }
        log.info("Webhook signature verified for gateway={}", gateway);

        // Parse the raw JSON body to a Map with proper type safety
        Map<String, Object> webhookPayload;
        try {
            webhookPayload = OBJECT_MAPPER.readValue(rawBody,
                    new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse webhook payload JSON for gateway={}", gateway, e);
            throw new IllegalArgumentException("Invalid webhook payload format");
        }

        // Extract common webhook fields with type-safe access
        String eventType = safeStringCast(webhookPayload.get("event"), "unknown");
        String gatewayPaymentId = extractGatewayPaymentId(webhookPayload);

        log.info("Processing webhook: gateway={}, eventType={}, gatewayPaymentId={}",
                gateway, eventType, gatewayPaymentId);

        Payment processed = paymentVerificationService.processWebhookEvent(
                gateway, eventType, gatewayPaymentId, webhookPayload);
        return new ApiResponse<>("Webhook processed", processed);
    }

    /**
     * Safely extract a string value from an unknown-typed map entry,
     * falling back to the default if null or not a string.
     */
    private static String safeStringCast(Object value, String defaultValue) {
        if (value instanceof String s) {
            return s;
        }
        return defaultValue;
    }

    /**
     * Extract a gateway payment ID from the webhook payload.
     * Different gateways place it at different locations.
     */
    private static String extractGatewayPaymentId(Map<String, Object> payload) {
        // Check common locations: data.payment_id, payment_id, data.object.id
        Object dataObj = payload.get("data");
        if (dataObj instanceof Map<?, ?> dataMap) {
            // Direct key lookup instead of iterating all entries
            Object paymentIdVal = dataMap.get("payment_id");
            if (paymentIdVal instanceof String s) {
                return s;
            }
            // Check data.object.id (common in Stripe webhooks)
            Object objectObj = dataMap.get("object");
            if (objectObj instanceof Map<?, ?> objectMap) {
                Object idVal = objectMap.get("id");
                if (idVal instanceof String s) {
                    return s;
                }
            }
        }
        // Fallback to top-level payment_id
        Object topLevelId = payload.get("payment_id");
        if (topLevelId instanceof String s) {
            return s;
        }
        return "";
    }

    // --- Request DTOs ---

    public record CreatePaymentIntentRequest(
            @NotNull @Min(1) Long bookingId,
            @NotNull java.math.BigDecimal amount,
            String gateway) {
    }

    public record VerifyPaymentRequest(
            @NotNull @Min(1) Long paymentId,
            @NotBlank String gatewayPaymentId,
            @NotBlank String signature,
            Map<String, String> extraParams) {
    }

    public record RefundPaymentRequest(
            @NotNull @Min(1) BigDecimal amount,
            String reason) {
    }
}
