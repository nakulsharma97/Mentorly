package com.skillswap.booking;

import com.skillswap.common.ApiResponse;
import com.skillswap.common.ApiClientException;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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

import java.util.List;

/**
 * REST controller exposing booking endpoints.
 */
@Tag(name = "Bookings", description = "Session booking creation, retrieval, cancellation, and confirmation")
@RestController
@Validated
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

        private static final Logger LOG = LoggerFactory.getLogger(BookingController.class);

        private final BookingRepository bookingRepository;
        private final EmailNotificationService emailService;
        private final BookingLifecycleService bookingLifecycleService;
        private final MeterRegistry meterRegistry;
        private final ProfileCompletionGuard profileCompletionGuard;

        @GetMapping
        public ApiResponse<Page<Booking>> list(
                        @AuthenticationPrincipal User currentUser,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {
                Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
                if (currentUser.getRole() == UserRole.ADMIN) {
                        return new ApiResponse<>("Bookings fetched",
                                        bookingRepository.findAll(pageable));
                }
                if (currentUser.getRole() == UserRole.MENTOR) {
                        return new ApiResponse<>("Bookings fetched",
                                        bookingRepository.findBySessionMentorId(currentUser.getId(), pageable));
                }
                return new ApiResponse<>("Bookings fetched",
                                bookingRepository.findByLearnerIdOrderByCreatedAtDesc(currentUser.getId(), pageable));
        }

        @PostMapping
        public ApiResponse<Booking> create(
                        @AuthenticationPrincipal User learner,
                        @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
                        @Valid @RequestBody BookingRequest req) {
                // Mandatory onboarding gate — learners must complete their profile first.
                profileCompletionGuard.requireProfileCompleted(learner,
                                "Please complete your profile before booking sessions.");
                incrementCounter("booking.create.request");

                try {
                        Booking saved = bookingLifecycleService.createBooking(learner, idempotencyKey, req);
                        incrementCounter("booking.create.success");
                        logBookingCreateOutcome("success", learner.getId(), req.sessionId(), idempotencyKey,
                                        "booking_created");
                        return new ApiResponse<>("Booking created", saved);
                } catch (IllegalArgumentException ex) {
                        String reason = ex.getMessage();
                        if (reason != null && reason.contains("idempotency")) {
                                incrementCounter("booking.create.replay");
                                logBookingCreateOutcome("replay", learner.getId(), req.sessionId(), idempotencyKey,
                                                "idempotency_replay");
                        } else {
                                incrementCounter("booking.create.failed", "reason",
                                        reason != null ? reason : "unknown");
                                logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                                reason != null ? reason : "unknown");
                        }
                        throw ex;
                } catch (ApiClientException ex) {
                        incrementCounter("booking.create.failed", "reason", "transient_conflict");
                        logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                        "transient_conflict");
                        throw ex;
                }
        }

        @PostMapping("/{id}/confirm")
        public ApiResponse<Booking> confirmBooking(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                profileCompletionGuard.requireProfileCompleted(currentUser,
                                "Please complete your profile before managing bookings.");
                Booking saved = bookingLifecycleService.confirmBooking(id, currentUser);
                return new ApiResponse<>("Booking confirmed", saved);
        }

        @PostMapping("/{id}/start")
        public ApiResponse<Booking> startBooking(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                profileCompletionGuard.requireProfileCompleted(currentUser,
                                "Please complete your profile before managing bookings.");
                Booking saved = bookingLifecycleService.startBooking(id, currentUser);
                return new ApiResponse<>("Booking started", saved);
        }

        @PostMapping("/{id}/mentor-join")
        public ApiResponse<Booking> mentorJoin(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                Booking saved = bookingLifecycleService.recordMentorJoin(id, currentUser);
                return new ApiResponse<>("Mentor join recorded", saved);
        }

        @PostMapping("/{id}/confirm-completion")
        public ApiResponse<Booking> confirmCompletion(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                Booking saved = bookingLifecycleService.confirmSessionCompletion(id, currentUser);
                return new ApiResponse<>("Completion confirmed", saved);
        }

        @PostMapping("/{id}/dispute-completion")
        public ApiResponse<Booking> disputeCompletion(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id,
                        @Valid @RequestBody DisputeCompletionRequest req) {
                Booking saved = bookingLifecycleService.disputeSessionCompletion(id, currentUser, req.reason());
                return new ApiResponse<>("Dispute filed", saved);
        }

        @PostMapping("/{id}/complete")
        public ApiResponse<Booking> completeBooking(
            @AuthenticationPrincipal User currentUser,
            @PathVariable @NotNull @Min(1) Long id) {
        profileCompletionGuard.requireProfileCompleted(currentUser,
                        "Please complete your profile before managing bookings.");
        Booking saved = bookingLifecycleService.completeBooking(id, currentUser);
        // Payout parity with the COMPLETED status-update path: escrowed funds
        // must be released to the mentor here too, otherwise completing via
        // this endpoint would leave the money stuck in escrow forever.
        bookingLifecycleService.releaseEscrowForCompletedBooking(saved);
        emailService.sendBookingCompleted(
                saved.getLearner(),
                saved.getSession().getMentor(),
                saved.getSession());
        return new ApiResponse<>("Booking completed", saved);
    }

        @PostMapping("/{id}/cancel")
        public ApiResponse<Booking> cancelBooking(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                profileCompletionGuard.requireProfileCompleted(currentUser,
                                "Please complete your profile before managing bookings.");
                Booking saved = bookingLifecycleService.cancelBooking(id, currentUser);
                return new ApiResponse<>("Booking cancelled", saved);
        }

        @PatchMapping("/{id}/status")
        public ApiResponse<Booking> updateStatus(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id,
                        @Valid @RequestBody StatusUpdateRequest req) {
                profileCompletionGuard.requireProfileCompleted(currentUser,
                                "Please complete your profile before managing bookings.");
                Booking saved = bookingLifecycleService.handleStatusUpdate(id, currentUser, req.status(), emailService);
                return new ApiResponse<>("Status updated", saved);
        }



        private void incrementCounter(String name, String... tags) {
                try {
                        meterRegistry.counter(name, tags).increment();
                } catch (RuntimeException ignored) {
                        // No-op in tests where metrics are mocked.
                }
        }

        private void logBookingCreateOutcome(String outcome, Long userId, Long sessionId, String idempotencyKey,
                        String reason) {
                LOG.info(
                                "booking_create outcome={} reason={} userId={} sessionId={}"
                                        + " idempotencyKey={} traceId={}",
                                outcome,
                                reason,
                                userId,
                                sessionId,
                                summarizeKey(idempotencyKey),
                                MDC.get("traceId") == null ? "na" : MDC.get("traceId"));
        }

        private static String summarizeKey(String key) {
                if (key == null || key.isBlank()) {
                        return "na";
                }
                int limit = Math.min(18, key.length());
                return key.substring(0, limit);
        }

        // ── Request DTOs ──

        public record DisputeCompletionRequest(
                @NotBlank(message = "A dispute reason is required")
                @jakarta.validation.constraints.Size(min = 10, max = 2000, message = "Reason must be 10-2000 characters")
                String reason) {
        }
}
