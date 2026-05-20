package com.skillswap.booking;

import com.skillswap.common.ApiResponse;
import com.skillswap.common.ApiClientException;
import com.skillswap.common.AuditableOperation;
import com.skillswap.common.IdempotencyKeySupport;
import com.skillswap.certification.CertificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.roadmap.LearningRoadmap;
import com.skillswap.roadmap.LearningRoadmapRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.waitlist.SessionWaitlistRepository;
import com.skillswap.waitlist.WaitlistStatus;
import io.micrometer.core.instrument.MeterRegistry;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;

@Tag(name = "Bookings", description = "Session booking creation, retrieval, cancellation, and confirmation")
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

        private static final Logger log = LoggerFactory.getLogger(BookingController.class);

        private final BookingRepository bookingRepository;
        private final SessionRepository sessionRepository;
        private final LearningRoadmapRepository learningRoadmapRepository;
        private final PaymentRepository paymentRepository;
        private final NotificationService notificationService;
        private final CertificationService certificationService;
        private final SessionWaitlistRepository sessionWaitlistRepository;
        private final BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;
        private final MeterRegistry meterRegistry;

        @GetMapping
        public ApiResponse<List<Booking>> list(@AuthenticationPrincipal User currentUser) {
                if (currentUser.getRole() == UserRole.ADMIN) {
                        return new ApiResponse<>("Bookings fetched", bookingRepository.findAll());
                }
                if (currentUser.getRole() == UserRole.MENTOR) {
                        return new ApiResponse<>("Bookings fetched",
                                        bookingRepository.findBySessionMentorId(currentUser.getId()));
                }
                return new ApiResponse<>("Bookings fetched", bookingRepository.findByLearnerIdOrderByCreatedAtDesc(
                                currentUser.getId()));
        }

        @PostMapping
        @Transactional
        public ApiResponse<Booking> create(
                        @AuthenticationPrincipal User learner,
                        @RequestHeader("Idempotency-Key") String idempotencyKey,
                        @RequestBody BookingRequest req) {
                incrementCounter("booking.create.request");

                if (learner.getRole() != UserRole.LEARNER && learner.getRole() != UserRole.ADMIN) {
                        incrementCounter("booking.create.failed", "reason", "invalid_role");
                        logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                        "invalid_role");
                        throw new IllegalArgumentException("Only learners can create bookings");
                }

                IdempotencyKeySupport.validate(idempotencyKey);
                logBookingCreateOutcome("validated", learner.getId(), req.sessionId(), idempotencyKey,
                                "idempotency_key_valid");

                String endpoint = "bookings.create";
                String requestHash = String.valueOf(req.sessionId());
                var existingKey = bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                                learner.getId(), endpoint, idempotencyKey);
                if (existingKey.isPresent()) {
                        BookingIdempotencyKey key = existingKey.get();
                        if (!key.getRequestHash().equals(requestHash)) {
                                incrementCounter("booking.create.failed", "reason", "idempotency_payload_mismatch");
                                logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                                "idempotency_payload_mismatch");
                                throw new IllegalArgumentException("Idempotency key reuse with different payload");
                        }
                        if (key.getBooking() != null) {
                                incrementCounter("booking.create.replay");
                                incrementCounter("booking.create.retry.success", "source", "idempotency_replay");
                                logBookingCreateOutcome("replay", learner.getId(), req.sessionId(), idempotencyKey,
                                                "idempotency_replay");
                                return new ApiResponse<>("Booking replayed", key.getBooking());
                        }
                }

                var session = sessionRepository.findById(req.sessionId())
                                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

                boolean alreadyBooked = bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(
                                session.getId(),
                                learner.getId(),
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED,
                                                BookingStatus.COMPLETED));
                if (alreadyBooked) {
                        incrementCounter("booking.create.failed", "reason", "already_booked");
                        logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                        "already_booked");
                        throw new IllegalArgumentException("You already have a booking for this session");
                }

                long activeBookingCount = bookingRepository.countBySessionIdAndBookingStatusIn(
                                session.getId(),
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED));
                int maxParticipants = session.getMaxParticipants() == null || session.getMaxParticipants() < 1
                                ? 1
                                : session.getMaxParticipants();
                if (activeBookingCount >= maxParticipants) {
                        incrementCounter("booking.create.failed", "reason", "session_full");
                        logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                        "session_full");
                        throw new IllegalArgumentException("Session is full. Join waitlist.");
                }

                Booking booking = new Booking();
                booking.setSession(session);
                booking.setLearner(learner);
                booking.setBookingStatus(BookingStatus.PENDING);

                Booking savedBooking;
                try {
                        savedBooking = bookingRepository.save(booking);
                } catch (DataIntegrityViolationException ex) {
                        incrementCounter("booking.create.failed", "reason", "transient_conflict");
                        logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                        "transient_conflict");
                        log.warn("booking_create_transient_conflict learnerId={} sessionId={} msg={}",
                                        learner.getId(), session.getId(), ex.getMessage());
                        throw new ApiClientException(
                                        HttpStatus.CONFLICT,
                                        "BOOKING_TEMPORARY_CONFLICT",
                                        "Temporary booking conflict. Please retry.",
                                        true);
                }

                LearningRoadmap roadmap = new LearningRoadmap();
                roadmap.setBooking(savedBooking);
                roadmap.setTitle("Roadmap: " + session.getTitle());
                roadmap.setMilestones(defaultMilestonesFor(session.getTitle()));
                roadmap.setProgressPercent(0);
                learningRoadmapRepository.save(roadmap);

                sessionWaitlistRepository
                                .findBySessionIdAndLearnerIdAndStatus(session.getId(), learner.getId(),
                                                WaitlistStatus.ACTIVE)
                                .ifPresent(waitlistItem -> {
                                        waitlistItem.setStatus(WaitlistStatus.JOINED);
                                        sessionWaitlistRepository.save(waitlistItem);
                                });

                notificationService.notifyUser(
                                session.getMentor().getId(),
                                "BOOKING_CREATED",
                                "New booking request",
                                learner.getFullName() + " requested your session: " + session.getTitle(),
                                savedBooking.getId());

                try {
                        BookingIdempotencyKey key = existingKey.orElseGet(BookingIdempotencyKey::new);
                        key.setUser(learner);
                        key.setEndpoint(endpoint);
                        key.setIdempotencyKey(idempotencyKey);
                        key.setRequestHash(requestHash);
                        key.setBooking(savedBooking);
                        bookingIdempotencyKeyRepository.save(key);
                } catch (DataIntegrityViolationException ex) {
                        Booking replayed = bookingIdempotencyKeyRepository
                                        .findByUserIdAndEndpointAndIdempotencyKey(learner.getId(), endpoint,
                                                        idempotencyKey)
                                        .map(BookingIdempotencyKey::getBooking)
                                        .orElse(savedBooking);
                        incrementCounter("booking.create.replay");
                        logBookingCreateOutcome("replay", learner.getId(), req.sessionId(), idempotencyKey,
                                        "idempotency_race");
                        return new ApiResponse<>("Booking replayed", replayed);
                }

                incrementCounter("booking.create.success");
                logBookingCreateOutcome("success", learner.getId(), req.sessionId(), idempotencyKey,
                                "booking_created");

                return new ApiResponse<>("Booking created", savedBooking);
        }

        @PatchMapping("/{id}/status")
        public ApiResponse<Booking> updateStatus(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable Long id,
                        @RequestBody StatusUpdateRequest req) {
                Booking booking = bookingRepository.findById(id)
                                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

                boolean isLearner = booking.getLearner().getId().equals(currentUser.getId());
                boolean isMentor = booking.getSession().getMentor().getId().equals(currentUser.getId());
                boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;
                if (!isLearner && !isMentor && !isAdmin) {
                        incrementCounter("booking.authz.denied", "action", "update_status");
                        throw new IllegalArgumentException("You cannot update this booking");
                }

                if (req.status() == BookingStatus.COMPLETED && !isMentor && !isAdmin) {
                        throw new IllegalArgumentException("Only mentor can complete a booking");
                }

                OffsetDateTime now = OffsetDateTime.now();
                if (req.status() == BookingStatus.CANCELLED) {
                        int cancellationWindow = booking.getSession().getCancellationWindowHours() == null
                                        ? 24
                                        : booking.getSession().getCancellationWindowHours();
                        OffsetDateTime deadline = booking.getSession().getStartTime().minusHours(cancellationWindow);

                        int refundPercent = now.isAfter(booking.getSession().getStartTime())
                                        ? 0
                                        : (now.isAfter(deadline) ? 50 : 100);

                        List<Payment> payments = paymentRepository.findByBookingId(booking.getId());
                        for (Payment payment : payments) {
                                if (payment.getStatus() == PaymentStatus.ESCROWED
                                                || payment.getStatus() == PaymentStatus.INITIATED) {
                                        BigDecimal refundAmount = payment.getAmount()
                                                        .multiply(BigDecimal.valueOf(refundPercent))
                                                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                                        payment.setRefundPercent(refundPercent);
                                        payment.setRefundAmount(refundAmount);
                                        payment.setRefundNote(refundPercent == 100
                                                        ? "Full refund within cancellation window"
                                                        : (refundPercent == 50
                                                                        ? "Partial refund after cancellation window"
                                                                        : "No refund after session start"));
                                        if (refundPercent > 0) {
                                                payment.setStatus(PaymentStatus.REFUNDED);
                                        }
                                }
                        }
                        paymentRepository.saveAll(payments);
                }

                if (req.status() == BookingStatus.RESCHEDULE_REQUESTED) {
                        int rescheduleWindow = booking.getSession().getRescheduleWindowHours() == null
                                        ? 12
                                        : booking.getSession().getRescheduleWindowHours();
                        OffsetDateTime deadline = booking.getSession().getStartTime().minusHours(rescheduleWindow);
                        if (now.isAfter(deadline)) {
                                throw new IllegalArgumentException("Reschedule window has passed for this session");
                        }
                }

                BookingStatus previousStatus = booking.getBookingStatus();
                booking.setBookingStatus(req.status());
                Booking saved = bookingRepository.save(booking);
                incrementCounter("booking.status.transition",
                                "from", previousStatus.name(),
                                "to", saved.getBookingStatus().name());

                notificationService.notifyUser(
                                booking.getLearner().getId(),
                                "BOOKING_STATUS",
                                "Booking status updated",
                                "Booking #" + booking.getId() + " is now " + booking.getBookingStatus().name(),
                                booking.getId());

                if (req.status() == BookingStatus.COMPLETED) {
                        certificationService.evaluateAndAward(booking.getLearner());
                        certificationService.evaluateAndAward(booking.getSession().getMentor());
                        notificationService.notifyUser(
                                        booking.getSession().getMentor().getId(),
                                        "REVIEW_SUBMITTED",
                                        "Session completed",
                                        "A completed session is ready for review and certification checks.",
                                        booking.getId());
                }
                notificationService.notifyUser(
                                booking.getSession().getMentor().getId(),
                                "BOOKING_STATUS",
                                "Booking status updated",
                                "Booking #" + booking.getId() + " is now " + booking.getBookingStatus().name(),
                                booking.getId());

                if (req.status() == BookingStatus.CANCELLED) {
                        sessionWaitlistRepository.findFirstBySessionIdAndStatusOrderByCreatedAtAsc(
                                        booking.getSession().getId(),
                                        WaitlistStatus.ACTIVE).ifPresent(waitlisted -> {
                                                waitlisted.setStatus(WaitlistStatus.NOTIFIED);
                                                sessionWaitlistRepository.save(waitlisted);
                                                notificationService.notifyUser(
                                                                waitlisted.getLearner().getId(),
                                                                "WAITLIST_PROMOTION",
                                                                "Seat available",
                                                                "A seat opened for session: "
                                                                                + booking.getSession().getTitle()
                                                                                + ". Book now.",
                                                                booking.getSession().getId());
                                        });
                }

                return new ApiResponse<>("Booking updated", saved);
        }

        public record BookingRequest(Long sessionId) {
        }

        public record StatusUpdateRequest(BookingStatus status) {
        }

        private static String defaultMilestonesFor(String sessionTitle) {
                String safeTitle = sessionTitle == null ? "Session" : sessionTitle.replace("\"", "\\\"");
                return "["
                                + "{\"title\":\"Kickoff and current level check\",\"status\":\"PENDING\"},"
                                + "{\"title\":\"Core concepts for " + safeTitle + "\",\"status\":\"PENDING\"},"
                                + "{\"title\":\"Hands-on assignment\",\"status\":\"PENDING\"},"
                                + "{\"title\":\"Review and next-step plan\",\"status\":\"PENDING\"}"
                                + "]";
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
                log.info(
                                "booking_create outcome={} reason={} userId={} sessionId={} idempotencyKey={} traceId={}",
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
}
