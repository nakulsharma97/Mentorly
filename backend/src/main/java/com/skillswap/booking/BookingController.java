package com.skillswap.booking;

import com.skillswap.common.ApiResponse;
import com.skillswap.common.ApiClientException;
import com.skillswap.common.AuditableOperation;
import com.skillswap.common.IdempotencyKeySupport;
import com.skillswap.certification.CertificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.referral.ReferralService;
import com.skillswap.roadmap.LearningRoadmap;
import com.skillswap.roadmap.LearningRoadmapRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.wallet.WalletService;
import com.skillswap.wallet.WalletTransactionType;
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
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;

@Tag(name = "Bookings", description = "Session booking creation, retrieval, cancellation, and confirmation")
@RestController
@Validated
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
public class BookingController {

        private static final Logger log = LoggerFactory.getLogger(BookingController.class);

        private final BookingRepository bookingRepository;
        private final SessionRepository sessionRepository;
        private final LearningRoadmapRepository learningRoadmapRepository;
        private final PaymentRepository paymentRepository;
        private final WalletService walletService;
        private final NotificationService notificationService;
        private final EmailNotificationService emailService;
        private final CertificationService certificationService;
        private final BookingLifecycleService bookingLifecycleService;
        private final ReferralService referralService;
        private final SessionWaitlistRepository sessionWaitlistRepository;
        private final BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;
        private final MeterRegistry meterRegistry;

        @GetMapping
        public ApiResponse<List<Booking>> list(@AuthenticationPrincipal User currentUser) {
                if (currentUser.getRole() == UserRole.ADMIN) {
                        return new ApiResponse<>("Bookings fetched",
                                        bookingRepository.findAll(org.springframework.data.domain.PageRequest.of(0, 1000)).getContent());
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
                        @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
                        @Valid @RequestBody BookingRequest req) {
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

                var session = sessionRepository.findByIdWithLock(req.sessionId())
                                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

                boolean alreadyBooked = bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(
                                session.getId(),
                                learner.getId(),
                                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS,
                                                BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED,
                                                BookingStatus.COMPLETED));
                if (alreadyBooked) {
                        incrementCounter("booking.create.failed", "reason", "already_booked");
                        logBookingCreateOutcome("failed", learner.getId(), req.sessionId(), idempotencyKey,
                                        "already_booked");
                        throw new IllegalArgumentException("You already have a booking for this session");
                }

                long activeBookingCount = bookingRepository.countActiveBySessionIdWithLock(
                                session.getId(),
                                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS,
                                                BookingStatus.ACCEPTED,
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
                emailService.sendBookingCreated(session.getMentor(), learner, session);

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

        @PostMapping("/{id}/confirm")
        public ApiResponse<Booking> confirmBooking(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                Booking saved = bookingLifecycleService.confirmBooking(id, currentUser);
                return new ApiResponse<>("Booking confirmed", saved);
        }

        @PostMapping("/{id}/start")
        public ApiResponse<Booking> startBooking(@PathVariable @NotNull @Min(1) Long id) {
                Booking saved = bookingLifecycleService.startBooking(id);
                return new ApiResponse<>("Booking started", saved);
        }

        @PostMapping("/{id}/complete")
        @Transactional
        public ApiResponse<Booking> completeBooking(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                Booking saved = bookingLifecycleService.completeBooking(id, currentUser);
                grantReferralRewardIfNeeded(saved);
                return new ApiResponse<>("Booking completed", saved);
        }

        @PostMapping("/{id}/cancel")
        public ApiResponse<Booking> cancelBooking(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id) {
                Booking saved = bookingLifecycleService.cancelBooking(id, currentUser);
                return new ApiResponse<>("Booking cancelled", saved);
        }

        @PatchMapping("/{id}/status")
        @Transactional
        public ApiResponse<Booking> updateStatus(
                        @AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id,
                        @Valid @RequestBody StatusUpdateRequest req) {
                return switch (req.status()) {
                        case ACCEPTED -> {
                                Booking booking = acceptBooking(id, currentUser);
                                holdEscrowForAcceptedBooking(booking);
                                emailService.sendBookingAccepted(
                                                booking.getLearner(),
                                                booking.getSession().getMentor(),
                                                booking.getSession());
                                yield new ApiResponse<>("Booking accepted", booking);
                        }
                        case CONFIRMED -> new ApiResponse<>("Booking confirmed",
                                        bookingLifecycleService.confirmBooking(id, currentUser));
                        case IN_PROGRESS -> throw new IllegalArgumentException(
                                        "IN_PROGRESS can only be set by the system scheduler");
                        case COMPLETED -> {
                                Booking booking = bookingLifecycleService.completeBooking(id, currentUser);
                                grantReferralRewardIfNeeded(booking);
                                releaseEscrowForCompletedBooking(booking);
                                emailService.sendBookingCompleted(
                                                booking.getLearner(),
                                                booking.getSession().getMentor(),
                                                booking.getSession());
                                yield new ApiResponse<>("Booking completed", booking);
                        }
                        case CANCELLED -> {
                                Booking booking = bookingLifecycleService.cancelBooking(id, currentUser);
                                int refundPercent = refundEscrowForCancelledBooking(booking);
                                emailService.sendBookingCancelled(
                                                booking.getLearner(),
                                                booking.getSession(),
                                                refundPercent);
                                yield new ApiResponse<>("Booking cancelled", booking);
                        }
                        default -> throw new IllegalArgumentException(
                                        "Use the dedicated booking lifecycle endpoints for state transitions");
                };
        }

        private Booking acceptBooking(Long bookingId, User currentUser) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
                SkillSession session = booking.getSession();
                if (session == null || session.getMentor() == null) {
                        throw new IllegalArgumentException("Booking session mentor is missing");
                }

                boolean isAdmin = currentUser != null && currentUser.getRole() == UserRole.ADMIN;
                boolean isMentor = currentUser != null
                                && currentUser.getRole() == UserRole.MENTOR
                                && session.getMentor().getId().equals(currentUser.getId());
                if (!isAdmin && !isMentor) {
                        throw new IllegalArgumentException("Only the session mentor can accept a booking");
                }

                if (booking.getBookingStatus() != BookingStatus.PENDING) {
                        throw new IllegalArgumentException("Only pending bookings can be accepted");
                }

                booking.setBookingStatus(BookingStatus.ACCEPTED);
                return bookingRepository.save(booking);
        }

        private void holdEscrowForAcceptedBooking(Booking booking) {
                User learner = booking.getLearner();
                SkillSession session = booking.getSession();
                BigDecimal priceAmount = session.getPriceAmount();
                if (priceAmount == null || priceAmount.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Session price must be greater than zero");
                }

                BigDecimal currentBalance = walletService.balance(learner).balance();
                if (currentBalance.compareTo(priceAmount) < 0) {
                        throw new IllegalArgumentException("Insufficient wallet balance to accept this booking");
                }

                walletService.addEntryForUser(learner.getId(), new WalletService.WalletEntryRequest(
                                WalletTransactionType.DEBIT,
                                priceAmount,
                                "CREDITS",
                                "Session booking: " + session.getTitle(),
                                "BOOKING",
                                booking.getId()));

                // Use existing payment if already linked, or create a new wallet-based payment
                Payment payment = booking.getPayment();
                if (payment == null) {
                        payment = Payment.builder()
                                        .orderId("WALLET_" + System.currentTimeMillis())
                                        .learnerId(booking.getLearner().getId())
                                        .mentorId(booking.getSession().getMentor().getId())
                                        .sessionId(booking.getSession().getId())
                                        .amount(priceAmount)
                                        .currency("INR")
                                        .gateway("wallet")
                                        .status(PaymentStatus.ESCROWED)
                                        .createdAt(OffsetDateTime.now())
                                        .build();
                } else {
                        payment.setAmount(priceAmount);
                        payment.setStatus(PaymentStatus.ESCROWED);
                }

                payment = paymentRepository.save(payment);
                booking.setPayment(payment);
                bookingRepository.save(booking);
        }

        private void releaseEscrowForCompletedBooking(Booking booking) {
                Payment payment = booking.getPayment();
                if (payment == null || payment.getStatus() != PaymentStatus.ESCROWED) {
                        return;
                }

                BigDecimal fee = payment.getAmount()
                                .multiply(BigDecimal.valueOf(0.10))
                                .setScale(2, RoundingMode.HALF_UP);
                BigDecimal payout = payment.getAmount().subtract(fee)
                                .setScale(2, RoundingMode.HALF_UP);

                User mentor = booking.getSession().getMentor();
                SkillSession session = booking.getSession();
                walletService.addEntryForUser(mentor.getId(),
                                new WalletService.WalletEntryRequest(
                                                WalletTransactionType.EARNING,
                                                payout,
                                                "CREDITS",
                                                "Session payout: " + session.getTitle()
                                                                + " (after 10% platform fee)",
                                                "BOOKING",
                                                booking.getId()));

                payment.setStatus(PaymentStatus.RELEASED);
                paymentRepository.save(payment);
        }

        private int refundEscrowForCancelledBooking(Booking booking) {
                Payment payment = booking.getPayment();
                if (payment == null) {
                        return 0;
                }

                if (payment.getStatus() != PaymentStatus.ESCROWED
                                && payment.getStatus() != PaymentStatus.REFUNDED) {
                        return 0;
                }

                int refundPercent = 100;
                BigDecimal refundAmount = payment.getAmount();

                User learner = booking.getLearner();
                SkillSession session = booking.getSession();
                walletService.addEntryForUser(learner.getId(), new WalletService.WalletEntryRequest(
                                WalletTransactionType.REFUND,
                                refundAmount,
                                "CREDITS",
                                "Refund for cancelled session: " + session.getTitle(),
                                "BOOKING",
                                booking.getId()));

                payment.setStatus(PaymentStatus.REFUNDED);
                paymentRepository.save(payment);
                return refundPercent;
        }

        private void grantReferralRewardIfNeeded(Booking booking) {
                if (booking == null || booking.getLearner() == null) {
                        return;
                }

                long completedCount = bookingRepository.countByLearnerIdAndBookingStatus(
                                booking.getLearner().getId(), BookingStatus.COMPLETED);
                if (completedCount == 1) {
                        referralService.processReferralReward(booking.getLearner().getId(), booking.getId());
                }
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
