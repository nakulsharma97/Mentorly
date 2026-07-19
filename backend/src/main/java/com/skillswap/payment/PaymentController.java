package com.skillswap.payment;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
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
                // Gateway unreachable — return current stored status
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

    /**
     * Process a gateway webhook event.
     */
    @PostMapping("/webhook/{gateway}")
    public ApiResponse<Payment> handleWebhook(@PathVariable @NotBlank String gateway,
            @RequestBody Map<String, Object> webhookPayload) {
        // Extract common webhook fields - adapters may parse differently
        String eventType = (String) webhookPayload.getOrDefault("event", "unknown");
        // In production, extract payment_id from gateway-specific payload location
        @SuppressWarnings("unchecked")
        Map<String, Object> eventData = (Map<String, Object>) webhookPayload.getOrDefault("data", Map.of());
        String gatewayPaymentId = (String) eventData.getOrDefault("payment_id",
                webhookPayload.getOrDefault("payment_id", "").toString());

        Payment processed = paymentVerificationService.processWebhookEvent(gateway, eventType,
                gatewayPaymentId, webhookPayload);
        return new ApiResponse<>("Webhook processed", processed);
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
