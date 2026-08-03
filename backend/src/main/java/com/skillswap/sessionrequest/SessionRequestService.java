package com.skillswap.sessionrequest;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SessionStatus;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Service implementing session request business logic.
 */
@Service
@RequiredArgsConstructor
public class SessionRequestService {

    private final SessionRequestRepository sessionRequestRepository;
    private final SessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /**
     * Learner sends a session request to a mentor.
     */
    @Transactional
    public SessionRequest createRequest(User learner, Long mentorId, String message,
                                         String subject, String preferredDate,
                                         String preferredTime, Integer preferredDuration,
                                         String budget) {
        if (learner.getRole() != UserRole.LEARNER && learner.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only learners can request sessions");
        }

        User mentor = userRepository.findById(mentorId)
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));

        if (mentor.getRole() != UserRole.MENTOR) {
            throw new IllegalArgumentException("User is not a mentor");
        }

        if (learner.getId().equals(mentorId)) {
            throw new IllegalArgumentException("You cannot request a session from yourself");
        }

        // Check for existing pending request
        boolean hasPending = sessionRequestRepository
                .existsByLearnerIdAndMentorIdAndStatus(learner.getId(), mentorId, SessionRequestStatus.PENDING);
        if (hasPending) {
            throw new IllegalArgumentException("You already have a pending request with this mentor");
        }

        SessionRequest request = new SessionRequest();
        request.setLearner(learner);
        request.setMentor(mentor);
        request.setMessage(message != null ? message.trim() : "");
        request.setSubject(subject);
        request.setPreferredDate(preferredDate);
        request.setPreferredTime(preferredTime);
        request.setPreferredDuration(preferredDuration);
        request.setBudget(budget);
        request.setStatus(SessionRequestStatus.PENDING);
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());

        SessionRequest saved = sessionRequestRepository.save(request);

        // Notify the mentor
        notificationService.notifyUser(
                mentor.getId(),
                "SESSION_REQUEST_RECEIVED",
                "New session request",
                learner.getFullName() + " requested a session with you"
                        + (message != null && !message.isBlank() ? ": \"" + message + "\"" : ""),
                saved.getId());

        return saved;
    }

    /**
     * List all pending session requests for a mentor, plus any requests the learner has replied to.
     */
    @Transactional(readOnly = true)
    public List<SessionRequest> listPendingForMentor(User mentor) {
        List<SessionRequest> pending = sessionRequestRepository
                .findByMentorIdAndStatusOrderByCreatedAtDesc(mentor.getId(), SessionRequestStatus.PENDING);
        List<SessionRequest> replied = sessionRequestRepository
                .findByMentorIdAndReplyMessageIsNotNull(mentor.getId());
        // Merge: pending first, then replied (excluding duplicates that are already pending)
        // Since pending requests can't have replies (the service prevents it), there should be no overlap
        for (SessionRequest r : replied) {
            if (pending.stream().noneMatch(p -> p.getId().equals(r.getId()))) {
                pending.add(r);
            }
        }
        // Sort by createdAt descending
        pending.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return pending;
    }

    /**
     * List all session requests for a learner (to track their requests).
     */
    @Transactional(readOnly = true)
    public List<SessionRequest> listForLearner(User learner) {
        return sessionRequestRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId());
    }

    /**
     * Mentor accepts a session request.
     * Auto-creates a session from the request and notifies the learner.
     */
    @Transactional
    public SessionRequest acceptRequest(User mentor, Long requestId, String message) {
        SessionRequest request = sessionRequestRepository.findByIdAndMentorId(requestId, mentor.getId())
                .orElseThrow(() -> new IllegalArgumentException("Session request not found"));

        if (request.getStatus() != SessionRequestStatus.PENDING) {
            throw new IllegalArgumentException("Request is no longer pending");
        }

        request.setStatus(SessionRequestStatus.ACCEPTED);
        request.setUpdatedAt(OffsetDateTime.now());
        request.setResolvedAt(OffsetDateTime.now());
        SessionRequest saved = sessionRequestRepository.save(request);

        // Build notification message
        String notificationMsg = mentor.getFullName() + " accepted your session request.";
        if (message != null && !message.isBlank()) {
            notificationMsg += " Message from mentor: \"" + message.trim() + "\"";
        }
        notificationMsg += " They will set up a session for you soon.";

        // Notify the learner
        notificationService.notifyUser(
                request.getLearner().getId(),
                "SESSION_REQUEST_ACCEPTED",
                "Session request accepted",
                notificationMsg,
                saved.getId());

        return saved;
    }

    /**
     * Mentor creates a session from an accepted request, setting time, title, price, etc.
     * This creates a SkillSession and a Booking linking the learner to it.
     */
    @Transactional
    public SkillSession createSessionFromRequest(User mentor, Long requestId,
                                                  String title,
                                                  String description,
                                                  OffsetDateTime startTime,
                                                  OffsetDateTime endTime,
                                                  BigDecimal priceAmount,
                                                  String meetingLink) {
        SessionRequest request = sessionRequestRepository.findByIdAndMentorId(requestId, mentor.getId())
                .orElseThrow(() -> new IllegalArgumentException("Session request not found"));

        if (request.getStatus() != SessionRequestStatus.ACCEPTED) {
            throw new IllegalArgumentException("Request must be accepted first before creating a session");
        }

        if (request.getSessionId() != null) {
            throw new IllegalArgumentException("A session has already been created for this request");
        }

        // Validate times
        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("Start and end times are required");
        }
        if (!endTime.isAfter(startTime)) {
            throw new IllegalArgumentException("End time must be after start time");
        }
        if (startTime.isBefore(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Start time must be in the future");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Session title is required");
        }

        // Create the session
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle(title.trim());
        session.setDescription(description != null ? description.trim() : "");
        session.setSessionType("ONLINE");
        session.setStartTime(startTime);
        session.setEndTime(endTime);
        session.setPriceAmount(priceAmount != null ? priceAmount : BigDecimal.ZERO);
        session.setMeetingLink(meetingLink);
        session.setCancellationWindowHours(24);
        session.setRescheduleWindowHours(12);
        session.setMaxParticipants(1);
        session.setStatus(SessionStatus.PENDING);
        session.setCreatedAt(OffsetDateTime.now());
        session.setUpdatedAt(OffsetDateTime.now());

        SkillSession savedSession = sessionRepository.save(session);

        // Create a booking linking the learner to this session
        Booking booking = new Booking();
        booking.setSession(savedSession);
        booking.setLearner(request.getLearner());
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setApprovedByAdmin(true);
        booking.setApprovedAt(OffsetDateTime.now());
        booking.setCreatedAt(OffsetDateTime.now());
        bookingRepository.save(booking);

        // Update the request with the session ID
        request.setSessionId(savedSession.getId());
        request.setUpdatedAt(OffsetDateTime.now());
        sessionRequestRepository.save(request);

        // Notify the learner with session details
        String msg = mentor.getFullName() + " has set up your session: \"" + savedSession.getTitle()
                + "\" starting at " + startTime.toString() + "."
                + (meetingLink != null && !meetingLink.isBlank()
                    ? " Meeting link: " + meetingLink
                    : "");
        notificationService.notifyUser(
                request.getLearner().getId(),
                "SESSION_CREATED",
                "Your session is ready",
                msg,
                savedSession.getId());

        return savedSession;
    }

    /**
     * Learner replies to a mentor's acceptance or decline message.
     */
    @Transactional
    public SessionRequest replyToRequest(User learner, Long requestId, String replyMessage) {
        SessionRequest request = sessionRequestRepository.findByIdAndLearnerId(requestId, learner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Session request not found"));

        if (request.getStatus() == SessionRequestStatus.PENDING) {
            throw new IllegalArgumentException(
                    "Cannot reply to a pending request. Wait for the mentor to respond first.");
        }

        if (replyMessage == null || replyMessage.isBlank()) {
            throw new IllegalArgumentException("Reply message cannot be empty");
        }

        request.setReplyMessage(replyMessage.trim());
        request.setUpdatedAt(OffsetDateTime.now());
        SessionRequest saved = sessionRequestRepository.save(request);

        // Notify the mentor
        String context = request.getStatus() == SessionRequestStatus.ACCEPTED ? "acceptance" : "decline";
        notificationService.notifyUser(
                request.getMentor().getId(),
                "SESSION_REQUEST_REPLIED",
                "Learner replied to your " + context,
                learner.getFullName() + " replied to your " + context + " message: \"" + replyMessage.trim() + "\"",
                saved.getId());

        return saved;
    }

    /**
     * Learner cancels/withdraws their own pending session request.
     */
    @Transactional
    public SessionRequest cancelRequest(User learner, Long requestId) {
        SessionRequest request = sessionRequestRepository.findByIdAndLearnerId(requestId, learner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Session request not found"));

        if (request.getStatus() != SessionRequestStatus.PENDING) {
            throw new IllegalArgumentException("Only pending requests can be cancelled");
        }

        request.setStatus(SessionRequestStatus.DECLINED);
        request.setDeclineReason("Cancelled by learner");
        request.setUpdatedAt(OffsetDateTime.now());
        request.setResolvedAt(OffsetDateTime.now());
        SessionRequest saved = sessionRequestRepository.save(request);

        // Notify the mentor
        notificationService.notifyUser(
                request.getMentor().getId(),
                "SESSION_REQUEST_CANCELLED",
                "Session request cancelled",
                learner.getFullName() + " cancelled their session request.",
                saved.getId());

        return saved;
    }

    /**
     * Mentor declines a session request.
     */
    @Transactional
    public SessionRequest declineRequest(User mentor, Long requestId, String reason) {
        SessionRequest request = sessionRequestRepository.findByIdAndMentorId(requestId, mentor.getId())
                .orElseThrow(() -> new IllegalArgumentException("Session request not found"));

        if (request.getStatus() != SessionRequestStatus.PENDING) {
            throw new IllegalArgumentException("Request is no longer pending");
        }

        request.setStatus(SessionRequestStatus.DECLINED);
        request.setDeclineReason(reason);
        request.setUpdatedAt(OffsetDateTime.now());
        request.setResolvedAt(OffsetDateTime.now());
        SessionRequest saved = sessionRequestRepository.save(request);

        // Notify the learner
        String declineMsg = reason != null && !reason.isBlank()
                ? mentor.getFullName() + " declined your session request. Reason: " + reason
                : mentor.getFullName() + " declined your session request.";
        notificationService.notifyUser(
                request.getLearner().getId(),
                "SESSION_REQUEST_DECLINED",
                "Session request declined",
                declineMsg,
                saved.getId());

        return saved;
    }
}
