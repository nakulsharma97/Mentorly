package com.mentorly.booking;

import com.mentorly.common.ApiClientException;
import com.mentorly.common.IdempotencyKeySupport;
import com.mentorly.certification.CertificationService;
import com.mentorly.notification.NotificationService;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.payment.Payment;
import com.mentorly.payment.PaymentRepository;
import com.mentorly.payment.PaymentService;
import com.mentorly.payment.PaymentStatus;
import com.mentorly.session.SessionStatus;
import com.mentorly.session.SessionType;
import com.mentorly.session.SkillSession;
import com.mentorly.session.SessionRepository;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import com.mentorly.wallet.WalletService;
import com.mentorly.wallet.WalletTransactionType;
import com.mentorly.waitlist.SessionWaitlistRepository;
import com.mentorly.waitlist.WaitlistStatus;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Service implementing booking lifecycle business logic.
 */
@Service
@RequiredArgsConstructor
public class BookingLifecycleService {

    private static final Logger LOG = LoggerFactory.getLogger(BookingLifecycleService.class);

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final CertificationService certificationService;
    private final SessionWaitlistRepository sessionWaitlistRepository;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final WalletService walletService;
    private final SessionRepository sessionRepository;
    private final BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;
    private final MeterRegistry meterRegistry;

    @Transactional
    public Booking confirmBooking(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
        requireMentor(currentUser, booking);
        requireCurrentState(booking, List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED),
                "Booking can only be confirmed while pending");

        booking.setBookingStatus(BookingStatus.CONFIRMED);
        Booking saved = bookingRepository.save(booking);
        sendEmail(saved, "Booking confirmed",
                "Your booking for %s has been confirmed by the mentor. Session starts at %s."
                        .formatted(sessionTitle(saved), sessionStart(saved)));
        return saved;
    }

    @Transactional
    public Booking startBooking(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
        requireStarter(currentUser, booking);
        requireCurrentState(booking, List.of(BookingStatus.CONFIRMED, BookingStatus.ACCEPTED),
                "Booking can only move to in progress after it has been confirmed");

        OffsetDateTime startTime = booking.getSession().getStartTime();
        if (startTime != null && OffsetDateTime.now().isBefore(startTime)) {
            throw new IllegalArgumentException("Booking cannot start before the session start time");
        }

        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        Booking saved = bookingRepository.save(booking);
        sendEmail(saved, "Booking in progress",
                "Your session %s is now in progress. Please join using the session link."
                        .formatted(sessionTitle(saved)));
        return saved;
    }

    @Transactional
    public Booking completeBooking(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
        requireParticipant(currentUser, booking,
                "Only the learner or mentor can complete a booking");
        requireCurrentState(booking, List.of(BookingStatus.IN_PROGRESS),
                "Booking can only be completed once it is in progress");

        OffsetDateTime endTime = booking.getSession().getEndTime();
        if (endTime != null && OffsetDateTime.now().isBefore(endTime)) {
            throw new IllegalArgumentException("Booking can only be completed after the session has ended");
        }


        booking.setBookingStatus(BookingStatus.COMPLETED);
        Booking saved = bookingRepository.save(booking);

        // Transition LIVE → ENDED on the session when booking is completed directly.
        com.mentorly.session.SkillSession session = saved.getSession();
        if (session.getLiveSessionStatus() == com.mentorly.session.LiveSessionStatus.LIVE) {
            session.setLiveSessionStatus(com.mentorly.session.LiveSessionStatus.ENDED);
            sessionRepository.save(session);
        }

        certificationService.evaluateAndAward(saved.getLearner());
        certificationService.evaluateAndAward(saved.getSession().getMentor());
        notificationService.notifyUser(
                saved.getLearner().getId(),
                "BOOKING_COMPLETED",
                "Session completed",
                "Your session \"" + sessionTitle(saved) + "\" has been completed. You can now leave a review.",
                saved.getId());
        notificationService.notifyUser(
                saved.getSession().getMentor().getId(),
                "BOOKING_COMPLETED",
                "Session completed",
                "Your session \"" + sessionTitle(saved) + "\" with "
                        + saved.getLearner().getFullName() + " has been completed.",
                saved.getId());
        sendEmail(saved, "Booking completed",
                "Your booking for %s has been marked completed. You can now leave a review."
                        .formatted(sessionTitle(saved)));
        return saved;
    }

    @Transactional
    public Booking cancelBooking(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
        requireParticipant(currentUser, booking, "Only the learner or mentor can cancel a booking");
        requireCurrentState(booking, List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACCEPTED),
                "Booking can only be cancelled before it is in progress");

        if (booking.getBookingStatus() == BookingStatus.CONFIRMED
                || booking.getBookingStatus() == BookingStatus.ACCEPTED) {
            requestRefundForConfirmedCancellation(booking);
        }

        booking.setBookingStatus(BookingStatus.CANCELLED);
        Booking saved = bookingRepository.save(booking);
        notifyWaitlist(saved);

        // Send in-app notification to the affected party
        String title = sessionTitle(saved);
        User mentor = saved.getSession().getMentor();
        User learner = saved.getLearner();

        // Notify the other party: if mentor cancelled, notify learner; if learner cancelled, notify mentor
        boolean cancelledByMentor = currentUser != null && currentUser.getId().equals(mentor.getId());
        Long notifyUserId = cancelledByMentor ? learner.getId() : mentor.getId();
        String notifyMessage = cancelledByMentor
                ? "Your session \"" + title + "\" was cancelled by " + mentor.getFullName()
                : learner.getFullName() + " cancelled the session \"" + title + "\"";

        notificationService.notifyUser(notifyUserId, "BOOKING_CANCELLED",
                "Session Cancelled", notifyMessage, saved.getId());

        sendEmail(saved, "Booking cancelled",
                "Your booking for %s has been cancelled. If payment was confirmed, a refund process has been started."
                        .formatted(title));
        return saved;
    }

    @Transactional
    public int promoteDueBookings() {
        List<Booking> dueBookings = bookingRepository.findByBookingStatusInAndSessionStartTimeLessThanEqual(
                List.of(BookingStatus.CONFIRMED, BookingStatus.ACCEPTED),
                OffsetDateTime.now());

        int promoted = 0;
        for (Booking booking : dueBookings) {
            if (booking.getBookingStatus() != BookingStatus.CONFIRMED
                    && booking.getBookingStatus() != BookingStatus.ACCEPTED) {
                continue;
            }

            booking.setBookingStatus(BookingStatus.IN_PROGRESS);
            bookingRepository.save(booking);
            sendEmail(booking, "Booking in progress",
                    "Your session %s is now in progress. Please join using the session link."
                            .formatted(sessionTitle(booking)));
            promoted++;
        }

        return promoted;
    }

    @Transactional
    public Booking createBooking(User learner, String idempotencyKey, BookingRequest req) {
        if (learner.getRole() != UserRole.LEARNER && learner.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only learners can create bookings");
        }

        IdempotencyKeySupport.validate(idempotencyKey);

        String endpoint = "bookings.create";
        String requestHash = String.valueOf(req.sessionId());
        var existingKey = bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                learner.getId(), endpoint, idempotencyKey);
        if (existingKey.isPresent()) {
            BookingIdempotencyKey key = existingKey.get();
            if (!key.getRequestHash().equals(requestHash)) {
                throw new IllegalArgumentException("Idempotency key reuse with different payload");
            }
            if (key.getBooking() != null) {
                return key.getBooking();
            }
        }

        var session = sessionRepository.findByIdWithLock(req.sessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        // Marketplace gate — learners may only book sessions hosted by mentors
        // whose verification is currently APPROVED.
        if (session.getMentor() == null || !session.getMentor().isApprovedMentor()) {
            throw new IllegalArgumentException("This mentor is currently unavailable.");
        }

        // A cancelled or completed session instance is permanently finished —
        // it can never be booked again (by anyone, ever).
        if (session.getStatus() == SessionStatus.CANCELLED
                || session.getStatus() == SessionStatus.COMPLETED) {
            throw new IllegalArgumentException("This session is no longer available.");
        }

        // PRIVATE sessions may only be booked by the single learner they were
        // created for. Never trust the frontend — the target is enforced here.
        if (session.getSessionType() == SessionType.PRIVATE
                && (session.getTargetLearner() == null
                        || !session.getTargetLearner().getId().equals(learner.getId()))) {
            throw new IllegalArgumentException("This session is no longer available.");
        }

        boolean alreadyBooked = bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(
                session.getId(),
                learner.getId(),
                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS,
                        BookingStatus.ACCEPTED,
                        BookingStatus.RESCHEDULE_REQUESTED,
                        BookingStatus.COMPLETED));
        if (alreadyBooked) {
            throw new IllegalArgumentException("You already have a booking for this session");
        }

        long activeBookingCount = bookingRepository.countActiveBySessionIdWithLock(
                session.getId(),
                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS,
                        BookingStatus.ACCEPTED,
                        BookingStatus.RESCHEDULE_REQUESTED,
                        BookingStatus.COMPLETED));
        int maxParticipants = session.getMaxParticipants() == null || session.getMaxParticipants() < 1
                ? 1
                : session.getMaxParticipants();
        if (activeBookingCount >= maxParticipants) {
            // 1:1 sessions — once ANY learner holds the slot, it's gone for
            // everyone else. The second racer gets the standard marketplace
            // message instead of an internal "session full" detail.
            if (maxParticipants <= 1) {
                throw new IllegalArgumentException("This session is no longer available.");
            }
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
            LOG.warn("booking_create_transient_conflict learnerId={} sessionId={} msg={}",
                    learner.getId(), session.getId(), ex.getMessage());
            throw new ApiClientException(
                    HttpStatus.CONFLICT,
                    "BOOKING_TEMPORARY_CONFLICT",
                    "Temporary booking conflict. Please retry.",
                    true);
        }

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
        emailNotificationService.sendBookingCreated(session.getMentor(), learner, session);

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
            return replayed;
        }

        return savedBooking;
    }

    private Booking loadBooking(Long bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
    }

    private void requireMentor(User currentUser, Booking booking) {
        if (currentUser == null || currentUser.getRole() != UserRole.MENTOR
                || !booking.getSession().getMentor().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Only the mentor can confirm a booking");
        }
    }

    private void requireParticipant(User currentUser, Booking booking, String message) {
        boolean isLearner = currentUser != null && currentUser.getRole() == UserRole.LEARNER
                && booking.getLearner().getId().equals(currentUser.getId());
        boolean isMentor = currentUser != null && currentUser.getRole() == UserRole.MENTOR
                && booking.getSession().getMentor().getId().equals(currentUser.getId());
        if (!isLearner && !isMentor) {
            throw new IllegalArgumentException(message);
        }
    }

    /**
     * Enforces that only the session mentor, the assigned learner, or an admin
     * may start a booking. Prevents any authenticated user from flipping an
     * unrelated booking to {@code IN_PROGRESS} (privilege escalation / IDOR).
     */
    private void requireStarter(User currentUser, Booking booking) {
        boolean isAdmin = currentUser != null && currentUser.getRole() == UserRole.ADMIN;
        if (!isAdmin) {
            requireParticipant(currentUser, booking,
                    "Only the session mentor, assigned learner, or an admin can start a booking");
        }
    }

    private void requireCurrentState(Booking booking, List<BookingStatus> allowedStates, String message) {
        if (!allowedStates.contains(booking.getBookingStatus())) {
            throw new IllegalArgumentException(message + " Current status: " + booking.getBookingStatus());
        }
    }

    private void requestRefundForConfirmedCancellation(Booking booking) {
        Payment payment = booking.getPayment();
        if (payment != null && (payment.getStatus() == PaymentStatus.ESCROWED
                || payment.getStatus() == PaymentStatus.INITIATED)) {
            // Gateway-first, idempotent refund — the external gateway is called
            // before the DB status flips; a gateway failure propagates and
            // rolls back the whole cancellation.
            paymentService.refundForCancellation(payment.getId(), payment.getAmount(), "Booking cancelled");
            LOG.info("booking_refund_requested bookingId={} sessionId={} paymentId={}",
                    booking.getId(), booking.getSession().getId(), payment.getId());
        }
    }

    private void notifyWaitlist(Booking booking) {
        sessionWaitlistRepository.findFirstBySessionIdAndStatusOrderByCreatedAtAsc(
                booking.getSession().getId(),
                WaitlistStatus.ACTIVE).ifPresent(waitlisted -> {
                    waitlisted.setStatus(WaitlistStatus.NOTIFIED);
                    sessionWaitlistRepository.save(waitlisted);
                });
    }

    private void sendEmail(Booking booking, String subject, String body) {
        emailNotificationService.sendNotificationEmail(booking.getLearner(), subject, body);
        emailNotificationService.sendNotificationEmail(booking.getSession().getMentor(), subject, body);
    }

    private static String sessionTitle(Booking booking) {
        SkillSession session = booking.getSession();
        return session == null || session.getTitle() == null ? "your session" : session.getTitle();
    }

    private static String sessionStart(Booking booking) {
        SkillSession session = booking.getSession();
        return session == null || session.getStartTime() == null ? "soon" : session.getStartTime().toString();
    }

    // ════════════════════════════════════════════════
    //  Status update handler (moved from BookingController)
    // ════════════════════════════════════════════════

    @Transactional
    public Booking handleStatusUpdate(Long id, User currentUser, BookingStatus targetStatus,
            EmailNotificationService emailService) {
        return switch (targetStatus) {
            case ACCEPTED -> {
                Booking booking = acceptBooking(id, currentUser);
                holdEscrowForAcceptedBooking(booking);
                emailService.sendBookingAccepted(
                        booking.getLearner(),
                        booking.getSession().getMentor(),
                        booking.getSession());
                yield booking;
            }
            case CONFIRMED -> confirmBooking(id, currentUser);
            case IN_PROGRESS -> throw new IllegalArgumentException(
                    "IN_PROGRESS can only be set by the system scheduler");
            case COMPLETED -> {
                Booking booking = completeBooking(id, currentUser);
                releaseEscrowForCompletedBooking(booking);
                emailService.sendBookingCompleted(
                        booking.getLearner(),
                        booking.getSession().getMentor(),
                        booking.getSession());
                yield booking;
            }
            case CANCELLED -> {
                Booking booking = cancelBooking(id, currentUser);
                int refundPercent = refundEscrowForCancelledBooking(booking);
                emailService.sendBookingCancelled(
                        booking.getLearner(),
                        booking.getSession(),
                        refundPercent);
                yield booking;
            }
            case RESCHEDULE_REQUESTED -> throw new IllegalArgumentException(
                    "Use POST /bookings/{id}/reschedule to request a reschedule");
            default -> throw new IllegalArgumentException(
                    "Use the dedicated booking lifecycle endpoints for state transitions");
        };
    }

    public Booking acceptBooking(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
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
        Booking saved = bookingRepository.save(booking);
        notificationService.notifyUser(
                booking.getLearner().getId(),
                "BOOKING_ACCEPTED",
                "Booking accepted",
                session.getMentor().getFullName() + " accepted your booking for \""
                        + session.getTitle() + "\".",
                saved.getId());
        return saved;
    }

    public void holdEscrowForAcceptedBooking(Booking booking) {
        User learner = booking.getLearner();
        SkillSession session = booking.getSession();
        BigDecimal priceAmount = session.getPriceAmount();
        if (priceAmount == null || priceAmount.compareTo(BigDecimal.ZERO) <= 0) {
            // Free (₹0) sessions have nothing to escrow — the booking is
            // accepted as-is and completed through the normal lifecycle.
            LOG.info("Skipping wallet escrow for free session booking={} (price=0)", booking.getId());
            return;
        }

        // A payment already exists for this booking — either a gateway intent in
        // flight (INITIATED: nothing charged yet, the gateway captures the funds
        // when the learner completes checkout) or a payment already escrowed via
        // the gateway. In both cases the escrow is (or will be) held by the
        // gateway, so the wallet path must be skipped entirely. Checking the
        // wallet balance first (as this method used to) wrongly blocked
        // acceptance for gateway payers whose wallet was never funded, and
        // debiting the wallet while a gateway intent was in flight could
        // double-charge learners who also complete the gateway checkout.
        Payment existingPayment = booking.getPayment();
        if (existingPayment != null) {
            LOG.info("Payment already exists for booking {}, status={} — skipping wallet escrow",
                    booking.getId(), existingPayment.getStatus());
            return;
        }

        // ── Wallet-escrow path (no payment created yet) ──
        // The learner is paying from their Mentorly wallet: require a
        // sufficient balance and hold the funds in escrow.
        BigDecimal currentBalance = walletService.balance(learner).balance();
        if (currentBalance.compareTo(priceAmount) < 0) {
            throw new IllegalArgumentException("Insufficient wallet balance to accept this booking");
        }

        walletService.addEntryForUser(learner.getId(), new WalletService.WalletEntryRequest(
                WalletTransactionType.DEBIT,
                priceAmount,
                "INR",
                "Session booking: " + session.getTitle(),
                "BOOKING",
                booking.getId()));

        Payment payment = Payment.builder()
                .orderId("WALLET_" + java.util.UUID.randomUUID().toString().replace("-", ""))
                .learnerId(booking.getLearner().getId())
                .mentorId(booking.getSession().getMentor().getId())
                .sessionId(booking.getSession().getId())
                .amount(priceAmount)
                .currency("INR")
                .gateway("wallet")
                .status(PaymentStatus.ESCROWED)
                .createdAt(OffsetDateTime.now())
                .build();

        payment = paymentRepository.save(payment);
        booking.setPayment(payment);
        bookingRepository.save(booking);
    }

    // ══════════════════════════════════════════════════════════════
    //  Dual-confirmation session completion flow
    // ══════════════════════════════════════════════════════════════

    /**
     * Record the mentor's join signal — lightweight timestamp, not heartbeat tracking.
     * Also transitions the session from SCHEDULED → LIVE if this is the first
     * participant to request the join link.
     */
    @Transactional
    public Booking recordMentorJoin(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
        if (currentUser.getRole() != UserRole.MENTOR
                || !booking.getSession().getMentor().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Only the session mentor can confirm joining");
        }
        if (booking.getMentorJoinLinkRequestedAt() == null) {
            booking.setMentorJoinLinkRequestedAt(OffsetDateTime.now());
        }

        // Transition SCHEDULED → LIVE when the mentor first requests the join link.
        com.mentorly.session.SkillSession session = booking.getSession();
        if (session.getLiveSessionStatus() == com.mentorly.session.LiveSessionStatus.SCHEDULED) {
            session.setLiveSessionStatus(com.mentorly.session.LiveSessionStatus.LIVE);
            sessionRepository.save(session);
        }

        return bookingRepository.save(booking);
    }

    /**
     * Called when a session's scheduled end time passes. Transitions IN_PROGRESS
     * bookings to the dual-confirmation flow by setting
     * completion_review_status = AWAITING_CONFIRMATION and notifying both parties.
     */
    @Transactional
    public int initiateCompletionConfirmations() {
        List<Booking> inProgressBookings = bookingRepository
                .findByBookingStatusIn(List.of(BookingStatus.IN_PROGRESS));

        OffsetDateTime now = OffsetDateTime.now();
        int initiated = 0;

        for (Booking booking : inProgressBookings) {
            OffsetDateTime endTime = booking.getSession().getEndTime();
            if (endTime == null || now.isBefore(endTime)) {
                continue; // Session hasn't ended yet
            }
            if (booking.getCompletionReviewStatus() != CompletionReviewStatus.NOT_APPLICABLE) {
                continue; // Already in a review flow
            }

            booking.setCompletionReviewStatus(CompletionReviewStatus.AWAITING_CONFIRMATION);
            bookingRepository.save(booking);

            // Transition LIVE → ENDED on the session when its scheduled end time passes.
            com.mentorly.session.SkillSession session = booking.getSession();
            if (session.getLiveSessionStatus() == com.mentorly.session.LiveSessionStatus.LIVE) {
                session.setLiveSessionStatus(com.mentorly.session.LiveSessionStatus.ENDED);
                sessionRepository.save(session);
            }

            // Notify both parties to confirm
            String sessionName = sessionTitle(booking);
            notificationService.notifyUser(
                    booking.getLearner().getId(),
                    "SESSION_CONFIRMATION_NEEDED",
                    "Did this session happen?",
                    "Your session \"" + sessionName + "\" has ended. Please confirm whether it took place.",
                    booking.getId());
            notificationService.notifyUser(
                    booking.getSession().getMentor().getId(),
                    "SESSION_CONFIRMATION_NEEDED",
                    "Did this session happen?",
                    "Your session \"" + sessionName + "\" has ended. Please confirm whether it took place.",
                    booking.getId());

            initiated++;
        }
        return initiated;
    }

    /**
     * Learner or mentor confirms the session happened. When both confirm,
     * the booking transitions to COMPLETED and escrow is released.
     */
    @Transactional
    public Booking confirmSessionCompletion(Long bookingId, User currentUser) {
        Booking booking = loadBooking(bookingId);
        requireParticipant(currentUser, booking,
                "Only the learner or mentor can confirm session completion");

        if (booking.getCompletionReviewStatus() != CompletionReviewStatus.AWAITING_CONFIRMATION
                && booking.getCompletionReviewStatus() != CompletionReviewStatus.REVIEW_REQUIRED) {
                throw new IllegalArgumentException(
                        "This booking is not awaiting confirmation. Current status: "
                                + booking.getCompletionReviewStatus());
        }

        boolean isLearner = currentUser.getId().equals(booking.getLearner().getId());
        OffsetDateTime now = OffsetDateTime.now();

        if (isLearner) {
            if (booking.getLearnerConfirmationStatus() == ConfirmationStatus.CONFIRMED) {
                throw new IllegalArgumentException("You have already confirmed this session");
            }
            booking.setLearnerConfirmationStatus(ConfirmationStatus.CONFIRMED);
            booking.setLearnerConfirmedAt(now);
        } else {
            if (booking.getMentorConfirmationStatus() == ConfirmationStatus.CONFIRMED) {
                throw new IllegalArgumentException("You have already confirmed this session");
            }
            booking.setMentorConfirmationStatus(ConfirmationStatus.CONFIRMED);
            booking.setMentorConfirmedAt(now);
        }

        // Check if BOTH have now confirmed
        if (booking.getLearnerConfirmationStatus() == ConfirmationStatus.CONFIRMED
                && booking.getMentorConfirmationStatus() == ConfirmationStatus.CONFIRMED) {
            // Both confirmed — complete the booking and release escrow
            booking.setBookingStatus(BookingStatus.COMPLETED);
            booking.setCompletionReviewStatus(CompletionReviewStatus.RESOLVED);
            bookingRepository.save(booking);

            // Transition LIVE → ENDED on the session when both parties confirm completion.
            com.mentorly.session.SkillSession sess = booking.getSession();
            if (sess.getLiveSessionStatus() == com.mentorly.session.LiveSessionStatus.LIVE) {
                sess.setLiveSessionStatus(com.mentorly.session.LiveSessionStatus.ENDED);
                sessionRepository.save(sess);
            }

            certificationService.evaluateAndAward(booking.getLearner());
            certificationService.evaluateAndAward(booking.getSession().getMentor());

            releaseEscrowForCompletedBooking(booking);

            notificationService.notifyUser(
                    booking.getLearner().getId(),
                    "BOOKING_COMPLETED",
                    "Session completed",
                    "Your session \"" + sessionTitle(booking) + "\" has been mutually confirmed as completed.",
                    booking.getId());
            notificationService.notifyUser(
                    booking.getSession().getMentor().getId(),
                    "BOOKING_COMPLETED",
                    "Session completed",
                    "Your session \"" + sessionTitle(booking) + "\" has been mutually confirmed as completed.",
                    booking.getId());
        } else {
            // Only one side confirmed — notify the other party
            Long pendingUserId = isLearner
                    ? booking.getSession().getMentor().getId()
                    : booking.getLearner().getId();
            notificationService.notifyUser(
                    pendingUserId,
                    "SESSION_CONFIRMATION_NEEDED",
                    "Confirmation received",
                    isLearner ? "The learner has confirmed this session. Please confirm as well."
                            : "The mentor has confirmed this session. Please confirm as well.",
                    booking.getId());
        }

        return bookingRepository.save(booking);
    }

    /**
     * Learner or mentor disputes the session. Sets the dispute reason and
     * transitions to DISPUTED for admin review.
     */
    @Transactional
    public Booking disputeSessionCompletion(Long bookingId, User currentUser, String reason) {
        Booking booking = loadBooking(bookingId);
        requireParticipant(currentUser, booking,
                "Only the learner or mentor can dispute a session");

        if (booking.getCompletionReviewStatus() != CompletionReviewStatus.AWAITING_CONFIRMATION
                && booking.getCompletionReviewStatus() != CompletionReviewStatus.REVIEW_REQUIRED) {
                throw new IllegalArgumentException(
                        "This booking is not in a state that can be disputed. Current status: "
                                + booking.getCompletionReviewStatus());
        }

        if (reason == null || reason.isBlank() || reason.trim().length() < 10) {
                throw new IllegalArgumentException(
                        "A dispute reason is required (minimum 10 characters)");
        }

        boolean isLearner = currentUser.getId().equals(booking.getLearner().getId());

        if (isLearner) {
                booking.setLearnerConfirmationStatus(ConfirmationStatus.DISPUTED);
                booking.setLearnerDisputeReason(reason.trim());
        } else {
                booking.setMentorConfirmationStatus(ConfirmationStatus.DISPUTED);
                booking.setMentorDisputeReason(reason.trim());
        }

        booking.setCompletionReviewStatus(CompletionReviewStatus.DISPUTED);
        booking.setBookingStatus(BookingStatus.REVIEW_REQUIRED);

        // Notify admin of the dispute (reuse existing admin notification pattern)
        notificationService.notifyAdmins(
                "SESSION_DISPUTE",
                "Session dispute filed",
                currentUser.getFullName() + " disputed session \"" + sessionTitle(booking)
                        + "\" (booking #" + booking.getId() + "). Reason: " + reason.trim(),
                booking.getId());

        return bookingRepository.save(booking);
    }

    /**
     * Timeout check for AWAITING_CONFIRMATION bookings. If the configurable
     * timeout (default 24 hours) has elapsed since the session end and only
     * one or zero sides have confirmed, escalate to REVIEW_REQUIRED.
     */
    @Transactional
    public int checkAwaitingConfirmations(long timeoutHours) {
        List<Booking> awaitingBookings = bookingRepository
                .findByCompletionReviewStatus(CompletionReviewStatus.AWAITING_CONFIRMATION);

        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(timeoutHours);
        int escalated = 0;

        for (Booking booking : awaitingBookings) {
            OffsetDateTime endTime = booking.getSession().getEndTime();
            if (endTime == null || endTime.isAfter(cutoff)) {
                continue; // Not enough time has passed
            }

            boolean learnerConfirmed = booking.getLearnerConfirmationStatus() == ConfirmationStatus.CONFIRMED;
            boolean mentorConfirmed = booking.getMentorConfirmationStatus() == ConfirmationStatus.CONFIRMED;

            if (!learnerConfirmed || !mentorConfirmed) {
                booking.setCompletionReviewStatus(CompletionReviewStatus.REVIEW_REQUIRED);
                bookingRepository.save(booking);

                notificationService.notifyAdmins(
                        "SESSION_REVIEW_NEEDED",
                        "Session completion requires review",
                        "Booking #" + booking.getId() + " (\"" + sessionTitle(booking)
                                + "\") has not been mutually confirmed after " + timeoutHours + " hours.",
                        booking.getId());

                escalated++;
            }
        }
        return escalated;
    }

    // ══════════════════════════════════════════════════════════════
    //  Reschedule flow
    // ══════════════════════════════════════════════════════════════

    /**
     * Learner or mentor requests a reschedule. Transitions the booking to
     * RESCHEDULE_REQUESTED and the session to RESCHEDULED. Only allowed for
     * bookings that haven't started yet (PENDING, ACCEPTED, CONFIRMED).
     */
    @Transactional
    public Booking requestReschedule(Long bookingId, User currentUser,
            java.time.OffsetDateTime newStartTime, java.time.OffsetDateTime newEndTime, String reason) {
        Booking booking = loadBooking(bookingId);
        requireParticipant(currentUser, booking,
                "Only the learner or mentor can request a reschedule");

        if (booking.getBookingStatus() != BookingStatus.PENDING
                && booking.getBookingStatus() != BookingStatus.ACCEPTED
                && booking.getBookingStatus() != BookingStatus.CONFIRMED) {
            throw new IllegalArgumentException(
                    "Can only reschedule bookings that have not started. Current status: "
                            + booking.getBookingStatus());
        }

        if (newStartTime == null || newEndTime == null) {
            throw new IllegalArgumentException("New start and end times are required");
        }
        if (!newEndTime.isAfter(newStartTime)) {
            throw new IllegalArgumentException("New end time must be after new start time");
        }
        if (newStartTime.isBefore(java.time.OffsetDateTime.now())) {
            throw new IllegalArgumentException("New start time must be in the future");
        }

        booking.setBookingStatus(BookingStatus.RESCHEDULE_REQUESTED);

        // Transition the session to RESCHEDULED if currently SCHEDULED or LIVE.
        com.mentorly.session.SkillSession session = booking.getSession();
        if (session.getLiveSessionStatus() == com.mentorly.session.LiveSessionStatus.SCHEDULED
                || session.getLiveSessionStatus() == com.mentorly.session.LiveSessionStatus.LIVE) {
            session.setLiveSessionStatus(com.mentorly.session.LiveSessionStatus.RESCHEDULED);
            sessionRepository.save(session);
        }

        Booking saved = bookingRepository.save(booking);

        // Notify the other party
        boolean requestedByMentor = currentUser.getId().equals(session.getMentor().getId());
        Long notifyUserId = requestedByMentor
                ? booking.getLearner().getId()
                : session.getMentor().getId();
        String notifierName = requestedByMentor ? session.getMentor().getFullName() : booking.getLearner().getFullName();
        notificationService.notifyUser(
                notifyUserId,
                "SESSION_RESCHEDULED",
                "Reschedule requested",
                notifierName + " requested to reschedule \"" + sessionTitle(booking)
                        + "\" to " + newStartTime + " – " + newEndTime
                        + (reason != null && !reason.isBlank() ? ". Reason: " + reason : "."),
                saved.getId());

        return saved;
    }

    public void releaseEscrowForCompletedBooking(Booking booking) {
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
                        "INR",
                        "Session payout: " + session.getTitle()
                                + " (after 10% platform fee)",
                        "BOOKING",
                        booking.getId()));

        payment.setStatus(PaymentStatus.RELEASED);
        paymentRepository.save(payment);
    }

    public int refundEscrowForCancelledBooking(Booking booking) {
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

        // Wallet-gateway escrow is internal money — refund it into the learner's
        // wallet. External-gateway payments were charged at the gateway, so the
        // refund goes back to the payer there; the wallet was never debited, so
        // no wallet credit is issued (prevents a double refund).
        if ("wallet".equalsIgnoreCase(payment.getGateway())) {
            User learner = booking.getLearner();
            SkillSession session = booking.getSession();
            walletService.addEntryForUser(learner.getId(), new WalletService.WalletEntryRequest(
                    WalletTransactionType.REFUND,
                    refundAmount,
                    "INR",
                    "Refund for cancelled session: " + session.getTitle(),
                    "BOOKING",
                    booking.getId()));
        }

        // Gateway-first, idempotent status flip (no-ops when this flow already
        // refunded the payment, e.g. after requestRefundForConfirmedCancellation).
        paymentService.refundForCancellation(payment.getId(), refundAmount, "Booking cancelled");
        return refundPercent;
    }
}
