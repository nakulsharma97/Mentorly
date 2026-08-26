package com.mentorly.booking;

import com.mentorly.common.exception.BadRequestException;
import com.mentorly.common.exception.ResourceNotFoundException;
import com.mentorly.common.exception.UnauthorizedException;
import com.mentorly.booking.dto.BookingResponse;
import com.mentorly.session.SkillSession;
import com.mentorly.session.SessionRepository;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for managing bookings and learner approvals.
 * Handles the approval workflow where admins approve or reject learners before
 * they can join.
 */
/**
 * Service implementing booking business logic.
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final SessionRepository sessionRepository;

    /**
     * Approves a learner's booking for a session.
     * Only the session's mentor (admin) can approve.
     *
     * @param bookingId the booking ID to approve
     * @param admin     the admin/mentor approving
     * @return the updated booking response
     */
    public BookingResponse approveLearnerBooking(Long bookingId, User admin) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        // Verify the admin owns the session
        if (!booking.getSession().getMentor().getId().equals(admin.getId())) {
            throw new UnauthorizedException("You can only approve learners for your own sessions");
        }

        // Check booking status
        if (booking.getBookingStatus() != BookingStatus.PENDING) {
            throw new BadRequestException("Only pending bookings can be approved");
        }

        // Approve the booking
        booking.setApprovedByAdmin(true);
        booking.setApprovedAt(OffsetDateTime.now());
        // Payment status is NOT auto-set to COMPLETED here.
        // Payment verification is handled by the dedicated payment flow.
        booking = bookingRepository.save(booking);

        log.info("Booking approved. Booking ID: {}, Learner ID: {}, Session ID: {}",
                bookingId, booking.getLearner().getId(), booking.getSession().getId());

        return mapToResponse(booking);
    }

    /**
     * Rejects a learner's booking for a session.
     * Only the session's mentor (admin) can reject.
     *
     * @param bookingId the booking ID to reject
     * @param reason    the reason for rejection
     * @param admin     the admin/mentor rejecting
     * @return the updated booking response
     */
    public BookingResponse rejectLearnerBooking(Long bookingId, String reason, User admin) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        // Verify the admin owns the session
        if (!booking.getSession().getMentor().getId().equals(admin.getId())) {
            throw new UnauthorizedException("You can only reject learners for your own sessions");
        }

        // Check booking status
        if (booking.getBookingStatus() != BookingStatus.PENDING) {
            throw new BadRequestException("Only pending bookings can be rejected");
        }

        // Reject the booking
        booking.setBookingStatus(BookingStatus.REJECTED);
        booking.setCancelReason(reason);
        booking.setApprovedByAdmin(false);
        booking = bookingRepository.save(booking);

        log.info("Booking rejected. Booking ID: {}, Learner ID: {}, Session ID: {}, Reason: {}",
                bookingId, booking.getLearner().getId(), booking.getSession().getId(), reason);

        return mapToResponse(booking);
    }

    /**
     * Bulk approves multiple bookings for a session.
     * Only the session's mentor (admin) can perform this action.
     *
     * @param sessionId  the session ID
     * @param bookingIds the list of booking IDs to approve
     * @param admin      the admin/mentor approving
     * @return list of approved booking responses
     */
    public List<BookingResponse> bulkApproveBookings(Long sessionId, List<Long> bookingIds, User admin) {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify the admin owns the session
        if (!session.getMentor().getId().equals(admin.getId())) {
            throw new UnauthorizedException("You can only approve learners for your own sessions");
        }

        List<Booking> bookings = bookingRepository.findByIdsAndSessionIdAndStatus(
                bookingIds, sessionId, BookingStatus.PENDING);

        bookings.forEach(b -> {
            b.setApprovedByAdmin(true);
            b.setApprovedAt(OffsetDateTime.now());
            // Payment status is handled by the dedicated payment verification flow.
            bookingRepository.save(b);
        });

        log.info("Bulk approved {} bookings for session {}", bookings.size(), sessionId);

        return bookings.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    /**
     * Bulk rejects multiple bookings for a session.
     * Only the session's mentor (admin) can perform this action.
     *
     * @param sessionId  the session ID
     * @param bookingIds the list of booking IDs to reject
     * @param reason     the reason for rejection
     * @param admin      the admin/mentor rejecting
     * @return list of rejected booking responses
     */
    public List<BookingResponse> bulkRejectBookings(Long sessionId, List<Long> bookingIds, String reason, User admin) {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify the admin owns the session
        if (!session.getMentor().getId().equals(admin.getId())) {
            throw new UnauthorizedException("You can only reject learners for your own sessions");
        }

        List<Booking> bookings = bookingRepository.findByIdsAndSessionIdAndStatus(
                bookingIds, sessionId, BookingStatus.PENDING);

        bookings.forEach(b -> {
            b.setBookingStatus(BookingStatus.REJECTED);
            b.setCancelReason(reason);
            b.setApprovedByAdmin(false);
            bookingRepository.save(b);
        });

        log.info("Bulk rejected {} bookings for session {}", bookings.size(), sessionId);

        return bookings.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    /**
     * Gets all pending bookings for a session.
     * Only the session's mentor (admin) can view.
     *
     * @param sessionId the session ID
     * @param admin     the admin/mentor
     * @return list of pending booking responses
     */
    public List<BookingResponse> getPendingBookingsForSession(Long sessionId, User admin) {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify the admin owns the session
        if (!session.getMentor().getId().equals(admin.getId())) {
            throw new UnauthorizedException("You can only view bookings for your own sessions");
        }

        List<Booking> bookings = bookingRepository.findBySessionMentorIdAndBookingStatus(
                admin.getId(),
                BookingStatus.PENDING);

        return bookings.stream()
                .filter(b -> b.getSession().getId().equals(sessionId))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Gets all approved bookings for a session.
     * Only the session's mentor (admin) can view.
     *
     * @param sessionId the session ID
     * @param admin     the admin/mentor
     * @return list of approved booking responses
     */
    public List<BookingResponse> getApprovedBookingsForSession(Long sessionId, User admin) {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify the admin owns the session
        if (!session.getMentor().getId().equals(admin.getId())) {
            throw new UnauthorizedException("You can only view bookings for your own sessions");
        }

        List<Booking> bookings = bookingRepository.findBySessionIdAndApprovedByAdminTrue(sessionId);

        return bookings.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    /**
     * Gets all bookings for a learner.
     *
     * @param learnerId the learner ID
     * @return list of booking responses
     */
    public List<BookingResponse> getLearnersBookings(Long learnerId) {
        List<Booking> bookings = bookingRepository.findByLearnerIdOrderByCreatedAtDesc(learnerId);
        return bookings.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    // Helper methods

    private BookingResponse mapToResponse(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .sessionId(booking.getSession().getId())
                .sessionTitle(booking.getSession().getTitle())
                .learnerId(booking.getLearner().getId())
                .learnerName(booking.getLearner().getFullName())
                .learnerUsername(booking.getLearner().getDisplayUsername())
                .mentorId(booking.getSession().getMentor().getId())
                .mentorName(booking.getSession().getMentor().getFullName())
                .mentorUsername(booking.getSession().getMentor().getDisplayUsername())
                .bookingStatus(booking.getBookingStatus())
                .paymentStatus(booking.getPaymentStatus())
                .approvedByAdmin(booking.getApprovedByAdmin())
                .approvedAt(booking.getApprovedAt())
                .joinedAt(booking.getJoinedAt())
                .createdAt(booking.getCreatedAt())
                .canJoin(booking.isApprovedForJoin())
                .build();
    }
}
