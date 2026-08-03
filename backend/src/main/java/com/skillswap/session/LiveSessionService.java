package com.skillswap.session;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.common.exception.ResourceNotFoundException;
import com.skillswap.common.exception.BadRequestException;
import com.skillswap.meeting.google.GoogleCalendarMeetingProvider;
import com.skillswap.meeting.provider.MeetingProviderException;
import com.skillswap.session.dto.CreateLiveSessionRequest;
import com.skillswap.session.dto.LiveSessionResponse;
import com.skillswap.session.dto.SecureJoinSessionResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for managing live sessions with Google Meet integration.
 * Handles automatic meeting creation, updates, and cancellations.
 */
/**
 * Service implementing live session business logic.
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class LiveSessionService {

    private final SessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final GoogleCalendarMeetingProvider meetingProvider;

    private static final int JOIN_WINDOW_BEFORE_MINUTES = 10;

    /**
     * Creates a new live session with automatic Google Meet link generation.
     *
     * @param request the session creation request
     * @param mentor  the mentor creating the session
     * @return the created session response
     * @throws MeetingProviderException if Google Meet creation fails
     */
    public LiveSessionResponse createLiveSession(CreateLiveSessionRequest request, User mentor)
            throws MeetingProviderException {

        // Validate request
        validateSessionRequest(request);

        // Create the session entity
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle(request.getTitle());
        session.setDescription(request.getDescription());
        session.setSessionType(request.getSessionType() != null ? request.getSessionType() : "LIVE_SESSION");
        session.setStartTime(request.getStartTime());
        session.setEndTime(request.getEndTime());
        session.setPriceAmount(request.getPriceAmount());
        session.setMaxParticipants(request.getMaxParticipants() != null ? request.getMaxParticipants() : 1);
        session.setCancellationWindowHours(
                request.getCancellationWindowHours() != null ? request.getCancellationWindowHours() : 24);
        session.setRescheduleWindowHours(
                request.getRescheduleWindowHours() != null ? request.getRescheduleWindowHours() : 12);
        session.setMeetingProvider(MeetingProvider.GOOGLE_CALENDAR);
        session.setLiveSessionStatus(LiveSessionStatus.SCHEDULED);
        session.setCreatedBy(mentor);
        session.setCreatedAt(OffsetDateTime.now());
        session.setUpdatedAt(OffsetDateTime.now());

        // Save session first to get an ID
        session = sessionRepository.save(session);

        // Generate Google Meet link
        try {
            String meetingLink = meetingProvider.createMeeting(session);
            session.setMeetingLink(meetingLink);
            session = sessionRepository.save(session);
            log.info("Live session created with automatic Google Meet link. Session ID: {}", session.getId());
        } catch (MeetingProviderException e) {
            // Clean up the session if meeting creation failed
            sessionRepository.delete(session);
            log.error("Failed to create Google Meet for session. Deleted incomplete session.", e);
            throw e;
        }

        return mapToResponse(session);
    }

    /**
     * Retrieves a session by ID for admin or mentor.
     * Does NOT expose the meeting link in the response.
     *
     * @param sessionId the session ID
     * @return the session response (without meeting link)
     */
    public LiveSessionResponse getSession(Long sessionId) {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));
        return mapToResponse(session);
    }

    /**
     * Securely returns the meeting link after verifying authorization.
     * ONLY called after permission checks in the controller.
     *
     * @param sessionId the session ID
     * @param learnerId the learner attempting to join
     * @return the secure join response with meeting link
     */
    public SecureJoinSessionResponse getSecureJoinLink(Long sessionId, Long learnerId) {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify the learner has an approved booking
        Booking booking = bookingRepository.findBySessionIdAndLearnerIdAndApprovedByAdminTrue(sessionId, learnerId)
                .orElseThrow(() -> new UnauthorizedException("You are not approved to join this session"));

        // Verify payment is complete
        if (!booking.getPaymentStatus().isCompleted()) {
            throw new UnauthorizedException("Payment not completed for this session");
        }

        // Check join window
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime joinWindowStart = session.getStartTime().minusMinutes(JOIN_WINDOW_BEFORE_MINUTES);
        boolean withinJoinWindow = !now.isBefore(joinWindowStart) && !now.isAfter(session.getEndTime());

        if (!withinJoinWindow) {
            long minutesUntilStart = java.time.temporal.ChronoUnit.MINUTES.between(now, session.getStartTime());
            return SecureJoinSessionResponse.builder()
                    .sessionId(sessionId)
                    .sessionTitle(session.getTitle())
                    .allowed(false)
                    .withinJoinWindow(false)
                    .minutesUntilStart(minutesUntilStart)
                    .minutesUntilEnd(java.time.temporal.ChronoUnit.MINUTES.between(now, session.getEndTime()))
                    .message("Join window not yet open. You can join from "
                            + JOIN_WINDOW_BEFORE_MINUTES + " minutes before the session starts.")
                    .build();
        }

        // Session must be active
        if (!session.getLiveSessionStatus().isActive()) {
            return SecureJoinSessionResponse.builder()
                    .sessionId(sessionId)
                    .sessionTitle(session.getTitle())
                    .allowed(false)
                    .message("This session is no longer available to join.")
                    .build();
        }

        // All checks passed - return the meeting link
        booking.setJoinedAt(OffsetDateTime.now());
        bookingRepository.save(booking);

        log.info("Learner {} approved to join session {}. Meeting link provided.", learnerId, sessionId);

        return SecureJoinSessionResponse.builder()
                .sessionId(sessionId)
                .sessionTitle(session.getTitle())
                .meetingLink(session.getMeetingLink())
                .allowed(true)
                .withinJoinWindow(true)
                .minutesUntilEnd(java.time.temporal.ChronoUnit.MINUTES.between(now, session.getEndTime()))
                .message("You are approved to join this session.")
                .build();
    }

    /**
     * Updates a live session and automatically updates the Google Meet event.
     *
     * @param sessionId the session ID
     * @param request   the update request
     * @param mentor    the mentor making the update
     * @return the updated session response
     */
    public LiveSessionResponse updateLiveSession(Long sessionId, CreateLiveSessionRequest request, User mentor)
            throws MeetingProviderException {

        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify ownership
        if (!session.getMentor().getId().equals(mentor.getId())) {
            throw new UnauthorizedException("You can only edit your own sessions");
        }

        // Check if session has already started
        if (session.getStartTime().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("Cannot edit a session that has already started");
        }

        // Update session details
        session.setTitle(request.getTitle());
        session.setDescription(request.getDescription());
        session.setStartTime(request.getStartTime());
        session.setEndTime(request.getEndTime());
        session.setPriceAmount(request.getPriceAmount());
        session.setMaxParticipants(request.getMaxParticipants());
        session.setUpdatedAt(OffsetDateTime.now());

        // Update Google Meet event
        if (session.getCalendarEventId() != null) {
            try {
                meetingProvider.updateMeeting(session, session.getMeetingId());
            } catch (MeetingProviderException e) {
                log.error("Failed to update Google Meet event", e);
                throw e;
            }
        }

        session = sessionRepository.save(session);
        log.info("Live session updated. Session ID: {}", sessionId);

        return mapToResponse(session);
    }

    /**
     * Cancels a live session and automatically deletes the Google Meet event.
     *
     * @param sessionId the session ID
     * @param mentor    the mentor cancelling the session
     */
    public void cancelLiveSession(Long sessionId, User mentor) throws MeetingProviderException {
        SkillSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Verify ownership
        if (!session.getMentor().getId().equals(mentor.getId())) {
            throw new UnauthorizedException("You can only cancel your own sessions");
        }

        // Delete from Google Calendar
        if (session.getCalendarEventId() != null) {
            try {
                meetingProvider.deleteMeeting(session.getCalendarEventId());
            } catch (MeetingProviderException e) {
                log.error("Failed to delete Google Meet event", e);
                throw e;
            }
        }

        // Update session status
        session.setLiveSessionStatus(LiveSessionStatus.CANCELLED);
        session.setUpdatedAt(OffsetDateTime.now());
        sessionRepository.save(session);

        // Mark all bookings as cancelled
        List<Booking> bookings = bookingRepository.findBySessionMentorId(mentor.getId());
        bookings.stream()
                .filter(b -> b.getSession().getId().equals(sessionId))
                .forEach(b -> {
                    b.setBookingStatus(BookingStatus.CANCELLED);
                    bookingRepository.save(b);
                });

        log.info("Live session cancelled. Session ID: {}", sessionId);
    }

    /**
     * Lists all upcoming sessions for a mentor.
     *
     * @param mentorId the mentor ID
     * @return list of session responses
     */
    public List<LiveSessionResponse> getUpcomingSessions(Long mentorId) {
        OffsetDateTime now = OffsetDateTime.now();
        List<SkillSession> sessions = sessionRepository
                .findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(mentorId, now);
        return sessions.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    // Helper methods

    private void validateSessionRequest(CreateLiveSessionRequest request) {
        if (request.getStartTime() == null || request.getEndTime() == null) {
            throw new BadRequestException("Start and end times are required");
        }

        if (!request.getStartTime().isBefore(request.getEndTime())) {
            throw new BadRequestException("End time must be after start time");
        }

        if (request.getStartTime().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("Session cannot start in the past");
        }

        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new BadRequestException("Session title is required");
        }

        if (request.getPriceAmount() == null) {
            throw new BadRequestException("Price amount is required");
        }
    }

    private LiveSessionResponse mapToResponse(SkillSession session) {
        long approvedCount = bookingRepository.countBySessionIdAndApprovedByAdminTrue(session.getId());
        long rejectedCount = bookingRepository
                .countBySessionIdAndBookingStatus(session.getId(), BookingStatus.REJECTED);
        long pendingCount = bookingRepository.countPendingNotApprovedBySessionId(
                session.getId(), BookingStatus.PENDING);

        return LiveSessionResponse.builder()
                .id(session.getId())
                .mentorId(session.getMentor().getId())
                .mentorName(session.getMentor().getFullName())
                .title(session.getTitle())
                .description(session.getDescription())
                .sessionType(session.getSessionType())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .priceAmount(session.getPriceAmount())
                .maxParticipants(session.getMaxParticipants())
                .currentParticipants((int) approvedCount)
                .cancellationWindowHours(session.getCancellationWindowHours())
                .rescheduleWindowHours(session.getRescheduleWindowHours())
                .status(session.getLiveSessionStatus())
                .meetingProvider(session.getMeetingProvider())
                .meetingGenerated(session.isMeetingGenerated())
                .approvedCount((int) approvedCount)
                .rejectedCount((int) rejectedCount)
                .pendingCount((int) pendingCount)
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .build();
    }
}
