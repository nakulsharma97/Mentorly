package com.skillswap.booking;

import com.skillswap.certification.CertificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.waitlist.SessionWaitlistRepository;
import com.skillswap.waitlist.WaitlistStatus;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(BookingLifecycleService.class);

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final CertificationService certificationService;
    private final SessionWaitlistRepository sessionWaitlistRepository;
    private final EmailNotificationService emailNotificationService;

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
    public Booking startBooking(Long bookingId) {
        Booking booking = loadBooking(bookingId);
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
        certificationService.evaluateAndAward(saved.getLearner());
        certificationService.evaluateAndAward(saved.getSession().getMentor());
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
        sendEmail(saved, "Booking cancelled",
                "Your booking for %s has been cancelled. If payment was confirmed, a refund process has been started."
                        .formatted(sessionTitle(saved)));
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

    private void requireCurrentState(Booking booking, List<BookingStatus> allowedStates, String message) {
        if (!allowedStates.contains(booking.getBookingStatus())) {
            throw new IllegalArgumentException(message + " Current status: " + booking.getBookingStatus());
        }
    }

    private void requestRefundForConfirmedCancellation(Booking booking) {
        Payment payment = booking.getPayment();
        if (payment != null && (payment.getStatus() == PaymentStatus.ESCROWED || payment.getStatus() == PaymentStatus.INITIATED)) {
            payment.setStatus(PaymentStatus.REFUNDED);
            paymentRepository.save(payment);
            log.info("booking_refund_requested bookingId={} sessionId={} paymentId={}",
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
}