package com.mentorly.payment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mentorly.common.ApiResponse;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * REST controller exposing payment endpoints.
 */
@Tag(name = "Payments", description = "Payment processing, gateway adapters, refunds, and transaction history")
@RestController
@Validated
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private static final Logger LOG = LoggerFactory.getLogger(PaymentController.class);

    private final PaymentService paymentService;
    private final PaymentVerificationService paymentVerificationService;
    private final PaymentRepository paymentRepository;
    private final ProfileCompletionGuard profileCompletionGuard;

    /**
     * Get payment history for the current user (paginated).
     */
    @GetMapping
    public ApiResponse<Page<Payment>> history(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return new ApiResponse<>("Payments fetched", paymentService.getPaymentHistory(currentUser, pageable));
    }

    /**
     * Get a specific payment by ID.
     */
    @GetMapping("/{id}")
    public ApiResponse<Payment> getPayment(@AuthenticationPrincipal User currentUser,
            @PathVariable @NotNull @Min(1) Long id) {
        // Ownership validated in the service layer (learner who paid, or admin)
        // — prevents IDOR on payment records.
        Payment payment = paymentService.getPayment(id, currentUser);
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
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before making payments.");
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
        // Ownership validated in the service layer — only the learner who paid
        // (or an admin) can confirm a payment.
        Payment verified = paymentVerificationService.verifyPayment(
                req.paymentId(), req.gatewayPaymentId(), req.signature(), req.extraParams(), currentUser);
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
                if ("captured".equalsIgnoreCase(gatewayStatus) || "completed".equalsIgnoreCase(gatewayStatus)
                        || "succeeded".equalsIgnoreCase(gatewayStatus)) {
                    // Complete the verification (ownership already checked above)
                    payment = paymentVerificationService.verifyPayment(
                            payment.getId(), payment.getPaymentId(), payment.getSignature(), Map.of(),
                            currentUser);
                }
            } catch (Exception e) {
                LOG.warn("Failed to fetch gateway status for paymentId={}", id, e);
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
        // Ownership validated in the service layer — only the learner who paid
        // (or an admin) can refund a payment.
        Payment refunded = paymentService.refundPayment(id, req.amount(), req.reason(), currentUser);
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
            @RequestHeader(value = "Stripe-Signature", required = false, defaultValue = "") String stripeSignatureHeader,
            @RequestHeader(value = "x-razorpay-signature", required = false, defaultValue = "") String razorpaySignatureHeader,
            @RequestHeader(value = "X-Razorpay-Event-Id", required = false, defaultValue = "") String razorpayEventIdHeader,
            @RequestBody String rawBody) {

        // Each gateway sends its signature in a different header:
        // - Stripe: Stripe-Signature
        // - Razorpay: x-razorpay-signature
        // - Others: X-Webhook-Signature
        boolean isStripe = "stripe".equalsIgnoreCase(gateway);
        boolean isRazorpay = "razorpay".equalsIgnoreCase(gateway);
        String effectiveSignature = isStripe ? stripeSignatureHeader
                : isRazorpay ? razorpaySignatureHeader : signatureHeader;

        // Resolve the gateway adapter for this webhook
        PaymentGateway gatewayAdapter = paymentService.resolveGateway(gateway);

        // Verify webhook signature — reject forged events before any processing.
        // Failure surfaces as 400 (see GlobalExceptionHandler) and is logged.
        if (!gatewayAdapter.verifyWebhookSignature(rawBody, effectiveSignature)) {
            LOG.warn("Webhook signature verification FAILED for gateway={} — rejecting event", gateway);
            throw new IllegalArgumentException("Invalid webhook signature");
        }
        LOG.info("Webhook signature verified for gateway={}", gateway);

        // Parse the raw JSON body to a Map with proper type safety
        Map<String, Object> webhookPayload;
        try {
            webhookPayload = OBJECT_MAPPER.readValue(rawBody,
                    new TypeReference<Map<String, Object>>() { });
        } catch (Exception e) {
            LOG.warn("Failed to parse webhook payload JSON for gateway={}", gateway, e);
            throw new IllegalArgumentException("Invalid webhook payload format");
        }

        // Stripe events carry the type at top level ("payment_intent.succeeded");
        // Razorpay/PayPal send it under "event".
        String eventType = isStripe
                ? safeStringCast(webhookPayload.get("type"), "unknown")
                : safeStringCast(webhookPayload.get("event"), "unknown");
        String gatewayPaymentId = extractGatewayPaymentId(webhookPayload);

        LOG.info("Processing webhook: gateway={}, eventType={}, gatewayPaymentId={}",
                gateway, eventType, gatewayPaymentId);

        Payment processed = paymentVerificationService.processWebhookEvent(
                gateway, eventType, gatewayPaymentId, webhookPayload, razorpayEventIdHeader);
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
     * Different gateways nest it differently:
     * - Stripe: data.object.id (e.g. pi_xxx)
     * - Razorpay: data.payment.entity.id (e.g. pay_xxx)
     * - Razorpay refunds: data.refund.entity.payment_id
     * - PayPal: resource.id
     */
    private static String extractGatewayPaymentId(Map<String, Object> payload) {
        Object dataObj = payload.get("data");
        if (dataObj instanceof Map<?, ?> dataMap) {
            // Razorpay: data.payment.entity.id
            Object paymentObj = dataMap.get("payment");
            if (paymentObj instanceof Map<?, ?> paymentMap) {
                Object entityObj = paymentMap.get("entity");
                if (entityObj instanceof Map<?, ?> entityMap) {
                    Object idVal = entityMap.get("id");
                    if (idVal instanceof String s && s.startsWith("pay_")) {
                        return s;
                    }
                }
            }
            // Razorpay refund: data.refund.entity.payment_id
            Object refundObj = dataMap.get("refund");
            if (refundObj instanceof Map<?, ?> refundMap) {
                Object refundEntity = refundMap.get("entity");
                if (refundEntity instanceof Map<?, ?> refundEntityMap) {
                    Object paymentIdVal = refundEntityMap.get("payment_id");
                    if (paymentIdVal instanceof String s) {
                        return s;
                    }
                }
            }
            // Stripe: data.object.id
            Object objectObj = dataMap.get("object");
            if (objectObj instanceof Map<?, ?> objectMap) {
                Object idVal = objectMap.get("id");
                if (idVal instanceof String s) {
                    return s;
                }
            }
            // Razorpay direct: data.payment_id
            Object paymentIdVal = dataMap.get("payment_id");
            if (paymentIdVal instanceof String s) {
                return s;
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

/**
 * Immutable data carrier for create payment intent request.
 */
    public record CreatePaymentIntentRequest(
            @NotNull @Min(1) Long bookingId,
            @NotNull BigDecimal amount,
            String gateway) {
    }

/**
 * Immutable data carrier for verify payment request.
 */
    public record VerifyPaymentRequest(
            @NotNull @Min(1) Long paymentId,
            @NotBlank String gatewayPaymentId,
            @NotBlank String signature,
            Map<String, String> extraParams) {
    }

/**
 * Immutable data carrier for refund payment request.
 */
    public record RefundPaymentRequest(
            @NotNull @Min(1) BigDecimal amount,
            String reason) {
    }
}
