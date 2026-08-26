package com.mentorly.session;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingLifecycleService;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.common.ApiResponse;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.common.exception.BadRequestException;
import com.mentorly.common.exception.ResourceNotFoundException;
import com.mentorly.notification.NotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import com.mentorly.watchlist.SavedMentorRepository;
import com.mentorly.watchlist.SkillWatchlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * REST controller exposing session endpoints.
 *
 * <p>Mentorly is a 1:1 mentoring marketplace. Each session instance may be
 * booked by AT MOST ONE learner. PUBLIC sessions are discoverable while
 * available; PRIVATE sessions are visible only to their target learner. All
 * access and booking rules are enforced here and in
 * {@link BookingLifecycleService} — never only on the frontend.
 */
@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final BookingLifecycleService bookingLifecycleService;
    private final SavedMentorRepository savedMentorRepository;
    private final SkillWatchlistRepository skillWatchlistRepository;
    private final NotificationService notificationService;
    private final ProfileCompletionGuard profileCompletionGuard;

    /** Booking states that permanently claim a session slot (incl. COMPLETED — a finished session is never re-bookable). */
    private static final List<BookingStatus> CLAIMED_STATUSES = List.of(
            BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACCEPTED,
            BookingStatus.IN_PROGRESS, BookingStatus.RESCHEDULE_REQUESTED, BookingStatus.COMPLETED);

    @GetMapping
    public ApiResponse<Page<SkillSession>> list(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (currentUser == null) {
            throw new IllegalArgumentException("Authentication required");
        }
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        if (currentUser.getRole() == UserRole.ADMIN) {
            return new ApiResponse<>("Sessions fetched",
                    sessionRepository.findByFilters(null, null, pageable));
        }
        if (currentUser.getRole() == UserRole.MENTOR) {
            Page<SkillSession> sessions = sessionRepository.findByMentorId(currentUser.getId(), pageable);
            enrichWithBookingSnapshot(sessions.getContent());
            return new ApiResponse<>("Sessions fetched", sessions);
        }
        if (currentUser.getRole() == UserRole.LEARNER) {
            return new ApiResponse<>("Sessions fetched",
                    sessionRepository.findByLearnerIdOrderByBookingCreatedAtDesc(currentUser.getId(), pageable));
        }
        throw new IllegalArgumentException("User role not permitted to view sessions");
    }

    /**
     * Public session discovery: only genuinely available PUBLIC sessions
     * (not booked, not cancelled, not completed, in the future).
     */
    @GetMapping("/public")
    public ApiResponse<Page<SkillSession>> listPublicSessions(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (currentUser == null) {
            throw new IllegalArgumentException("Authentication required");
        }
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return new ApiResponse<>("Available public sessions fetched",
                sessionRepository.findAvailablePublicSessions(OffsetDateTime.now(), CLAIMED_STATUSES, pageable));
    }

    /**
     * PRIVATE sessions for the current user.
     * <ul>
     *   <li>Learner → sessions created for them (and not yet booked).</li>
     *   <li>Mentor  → private sessions they created.</li>
     *   <li>Admin   → every private session.</li>
     * </ul>
     */
    @GetMapping("/private")
    public ApiResponse<List<SkillSession>> listPrivateSessions(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            throw new IllegalArgumentException("Authentication required");
        }
        if (currentUser.getRole() == UserRole.LEARNER) {
            return new ApiResponse<>("Private sessions fetched",
                    sessionRepository.findAvailablePrivateSessionsForLearner(
                            currentUser.getId(), OffsetDateTime.now(), CLAIMED_STATUSES));
        }
        if (currentUser.getRole() == UserRole.MENTOR) {
            return new ApiResponse<>("Private sessions fetched",
                    sessionRepository.findByMentorIdAndSessionType(currentUser.getId(), SessionType.PRIVATE));
        }
        // Admin: all private sessions.
        List<SkillSession> privates = sessionRepository
                .findBySessionType(SessionType.PRIVATE, PageRequest.of(0, 500)).getContent();
        return new ApiResponse<>("Private sessions fetched", privates);
    }

    /**
     * Learner search for mentors creating PRIVATE sessions (by name, username,
     * or email). Mentors only — learners must never discover private targets.
     */
    @GetMapping("/learners")
    public ApiResponse<Page<User>> searchLearners(
            @AuthenticationPrincipal User mentor,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (mentor == null || mentor.getRole() != UserRole.MENTOR || !mentor.isApprovedMentor()) {
            throw new BadRequestException("Only verified mentors can select a learner for a private session");
        }
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 50)));
        String query = (q == null || q.isBlank()) ? null : q.trim();
        return new ApiResponse<>("Learners fetched",
                userRepository.findByFilters(UserRole.LEARNER, query, pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<SkillSession> get(@PathVariable Long id, @AuthenticationPrincipal User currentUser) {
        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // PRIVATE sessions are only visible to the mentor who created them, the
        // target learner, and admins. Everyone else gets a 404 (no existence leak).
        if (session.getSessionType() == SessionType.PRIVATE
                && !canAccessPrivateSession(currentUser, session)) {
            throw new ResourceNotFoundException("Session not found");
        }
        return new ApiResponse<>("Session fetched", session);
    }

    @GetMapping("/mentor/{mentorId}")
    public ApiResponse<List<SkillSession>> listMentorSessions(@PathVariable Long mentorId) {
        // Public profile listing: only currently available PUBLIC sessions.
        // Private sessions and already-booked sessions never surface here.
        List<SkillSession> sessions = sessionRepository.findAvailablePublicSessionsByMentorId(
                mentorId, OffsetDateTime.now(), CLAIMED_STATUSES);
        return new ApiResponse<>("Mentor sessions fetched", sessions);
    }

    @PostMapping
    public ApiResponse<SkillSession> create(@AuthenticationPrincipal User mentor,
            @RequestBody CreateSessionRequest req) {
        // Mandatory onboarding gate — mentors must complete their profile first.
        profileCompletionGuard.requireProfileCompleted(mentor,
                "Please complete your profile before creating sessions.");
        // Marketplace gate — only admin-APPROVED mentors may publish sessions.
        if (!mentor.isApprovedMentor()) {
            throw new BadRequestException(
                    "Your mentor profile is awaiting verification. You cannot create sessions "
                            + "until an admin approves your profile. Estimated review time: 24–48 hours.");
        }
        validateCreateRequest(req);
        SessionType type = parseSessionType(req.sessionType());
        User targetLearner = null;
        if (type == SessionType.PRIVATE) {
            targetLearner = requireTargetLearner(req.targetLearnerId());
        }

        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle(req.title());
        session.setDescription(req.description());
        session.setSessionType(type);
        session.setTargetLearner(targetLearner);
        session.setStartTime(req.startTime());
        session.setEndTime(req.endTime());
        session.setPriceAmount(req.priceAmount());
        session.setMeetingLink(normalizeHttpUrl(req.meetingLink()));
        session.setCancellationWindowHours(req.cancellationWindowHours() == null ? 24 : req.cancellationWindowHours());
        session.setRescheduleWindowHours(req.rescheduleWindowHours() == null ? 12 : req.rescheduleWindowHours());
        // 1:1 marketplace — one session instance belongs to at most one learner.
        session.setMaxParticipants(1);
        session.setStatus(SessionStatus.PENDING);
        SkillSession saved = sessionRepository.save(session);

        if (type == SessionType.PRIVATE) {
            // Private session: notify ONLY the target learner.
            notificationService.notifyUser(
                    targetLearner.getId(),
                    "PRIVATE_SESSION_CREATED",
                    "New Private Session",
                    mentor.getFullName() + " created a private " + saved.getTitle()
                            + " session specifically for you.",
                    saved.getId());
        } else {
            notifyPublicSessionSubscribers(mentor, saved);
        }

        return new ApiResponse<>("Session created", saved);
    }

    @PatchMapping("/{id}")
    @Transactional
    public ApiResponse<SkillSession> update(
            @PathVariable Long id,
            @AuthenticationPrincipal User mentor,
            @RequestBody CreateSessionRequest req) {
        // Marketplace gate — unapproved/suspended mentors must not keep editing
        // published sessions after losing their verified status.
        if (!mentor.isApprovedMentor()) {
            throw new BadRequestException(
                    "Your mentor profile is awaiting verification. You cannot manage sessions "
                            + "until an admin approves your profile.");
        }
        validateCreateRequest(req);
        SessionType newType = parseSessionType(req.sessionType());
        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        if (!session.getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("Only the mentor who created this session can update it");
        }

        SessionType currentType = session.getSessionType() == null ? SessionType.PUBLIC : session.getSessionType();
        boolean changingVisibility = newType != currentType;
        boolean claimed = hasClaimedBooking(session.getId());

        if (claimed) {
            // A booked session's visibility cannot change, and its target learner
            // cannot be swapped to another learner while the slot is claimed.
            if (changingVisibility) {
                throw new BadRequestException(
                        "This session is already booked and its visibility cannot be changed.");
            }
            Long currentTarget = session.getTargetLearner() != null ? session.getTargetLearner().getId() : null;
            if (newType == SessionType.PRIVATE && req.targetLearnerId() != null
                    && !req.targetLearnerId().equals(currentTarget)) {
                throw new BadRequestException(
                        "This session is already booked — the target learner cannot be changed.");
            }
        }

        // PRIVATE → PUBLIC requires an explicit confirmation from the mentor.
        if (currentType == SessionType.PRIVATE && newType == SessionType.PUBLIC
                && !Boolean.TRUE.equals(req.confirmMakePublic())) {
            throw new BadRequestException(
                    "Make this session public? It will become visible to other learners. "
                            + "Set confirmMakePublic=true to confirm.");
        }

        // PUBLIC → PRIVATE requires exactly one target learner.
        User targetLearner = null;
        if (newType == SessionType.PRIVATE) {
            targetLearner = requireTargetLearner(req.targetLearnerId());
        }

        session.setTitle(req.title());
        session.setDescription(req.description());
        session.setSessionType(newType);
        session.setTargetLearner(targetLearner);
        session.setStartTime(req.startTime());
        session.setEndTime(req.endTime());
        session.setPriceAmount(req.priceAmount());
        session.setMeetingLink(normalizeHttpUrl(req.meetingLink()));
        session.setCancellationWindowHours(req.cancellationWindowHours() == null ? 24 : req.cancellationWindowHours());
        session.setRescheduleWindowHours(req.rescheduleWindowHours() == null ? 12 : req.rescheduleWindowHours());
        session.setMaxParticipants(1);
        session.setUpdatedAt(OffsetDateTime.now());

        SkillSession saved = sessionRepository.save(session);

        if (newType == SessionType.PRIVATE && targetLearner != null) {
            notificationService.notifyUser(
                    targetLearner.getId(),
                    "PRIVATE_SESSION_CREATED",
                    "New Private Session",
                    mentor.getFullName() + " created a private " + saved.getTitle()
                            + " session specifically for you.",
                    saved.getId());
        }

        return new ApiResponse<>("Session updated", saved);
    }

    @PatchMapping("/{id}/meeting-link")
    public ApiResponse<SkillSession> updateMeetingLink(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            @RequestBody UpdateMeetingLinkRequest req) {
        // Marketplace gate — suspended/unapproved mentors may not change links on
        // published sessions.
        if (!currentUser.isApprovedMentor()) {
            throw new BadRequestException(
                    "Your mentor profile is awaiting verification. You cannot manage sessions "
                            + "until an admin approves your profile.");
        }
        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        if (!session.getMentor().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Only mentor can update meeting link");
        }

        session.setMeetingLink(normalizeHttpUrl(req.meetingLink()));
        return new ApiResponse<>("Meeting link updated", sessionRepository.save(session));
    }

    /**
     * Mentor cancels a session. Existing bookings are cancelled through the
     * standard booking lifecycle (refund + notifications + waitlist promotion),
     * the session is removed from discovery, and the affected learner is
     * notified. Private sessions that were never booked still notify the
     * target learner.
     */
    @PostMapping("/{id}/cancel")
    @Transactional
    public ApiResponse<SkillSession> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        SkillSession session = sessionRepository.findByIdWithLock(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        boolean isOwner = session.getMentor() != null
                && session.getMentor().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole() == UserRole.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new IllegalArgumentException("Only the mentor who created this session can cancel it");
        }
        if (session.getStatus() == SessionStatus.CANCELLED) {
            throw new BadRequestException("This session is already cancelled");
        }

        // Cancel every active booking through the standard lifecycle (handles
        // refunds for confirmed bookings + in-app notifications).
        List<Booking> bookings = bookingRepository.findBySessionId(session.getId());
        for (Booking booking : bookings) {
            BookingStatus bs = booking.getBookingStatus();
            if (bs == BookingStatus.PENDING || bs == BookingStatus.CONFIRMED
                    || bs == BookingStatus.ACCEPTED || bs == BookingStatus.IN_PROGRESS
                    || bs == BookingStatus.RESCHEDULE_REQUESTED) {
                bookingLifecycleService.cancelBooking(booking.getId(), currentUser);
            }
        }

        session.setStatus(SessionStatus.CANCELLED);
        session.setMeetingLink(null);
        session.setUpdatedAt(OffsetDateTime.now());
        SkillSession saved = sessionRepository.save(session);

        // Unbooked private session → let the target learner know.
        if (session.getSessionType() == SessionType.PRIVATE
                && session.getTargetLearner() != null && bookings.isEmpty()) {
            notificationService.notifyUser(
                    session.getTargetLearner().getId(),
                    "SESSION_CANCELLED",
                    "Session Cancelled",
                    currentUser.getFullName() + " cancelled the private session \"" + saved.getTitle() + "\".",
                    saved.getId());
        }

        return new ApiResponse<>("Session cancelled", saved);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        if (!session.getMentor().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Only the mentor who created this session can delete it");
        }

        sessionRepository.delete(session);
        return new ApiResponse<>("Session deleted", null);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    private void validateCreateRequest(CreateSessionRequest req) {
        if (req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("Session title is required");
        }
        if (req.startTime() == null) {
            throw new BadRequestException("Start time is required");
        }
        if (req.endTime() == null) {
            throw new BadRequestException("End time is required");
        }
        if (!req.endTime().isAfter(req.startTime())) {
            throw new BadRequestException("End time must be after start time");
        }
        if (req.startTime().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("Start time must be in the future");
        }
        if (req.priceAmount() == null || req.priceAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Price must be 0 or greater");
        }
    }

    private static SessionType parseSessionType(String raw) {
        if (raw == null || raw.isBlank()) {
            return SessionType.PUBLIC;
        }
        try {
            return SessionType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Session type must be PUBLIC or PRIVATE");
        }
    }

    /**
     * Loads and validates the target learner for a PRIVATE session. The
     * {@code targetLearnerId} is never trusted blindly — it must reference an
     * enabled LEARNER account.
     */
    private User requireTargetLearner(Long targetLearnerId) {
        if (targetLearnerId == null) {
            throw new BadRequestException("A learner must be selected for a private session");
        }
        User learner = userRepository.findById(targetLearnerId)
                .orElseThrow(() -> new BadRequestException("Selected learner not found"));
        if (learner.getRole() != UserRole.LEARNER) {
            throw new BadRequestException("Private sessions can only target learner accounts");
        }
        if (!learner.isEnabled()) {
            throw new BadRequestException("Selected learner account is not active");
        }
        return learner;
    }

    private boolean canAccessPrivateSession(User currentUser, SkillSession session) {
        if (currentUser == null) {
            return false;
        }
        if (currentUser.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (session.getMentor() != null && session.getMentor().getId().equals(currentUser.getId())) {
            return true;
        }
        return session.getTargetLearner() != null
                && session.getTargetLearner().getId().equals(currentUser.getId());
    }

    private boolean hasClaimedBooking(Long sessionId) {
        return bookingRepository.countBySessionIdAndBookingStatusIn(sessionId, CLAIMED_STATUSES) > 0;
    }

    /**
     * Attaches the latest booking snapshot (booked learner + state) to the
     * mentor's session list so the UI can render "Booked by Rahul" vs
     * "Available" without a second request per session.
     */
    private void enrichWithBookingSnapshot(List<SkillSession> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        List<Booking> bookings = bookingRepository.findBySessionMentorId(
                sessions.get(0).getMentor().getId());
        for (SkillSession session : sessions) {
            session.setBookedByLearnerName(null);
            session.setBookedByLearnerId(null);
            session.setBookingState(null);
            for (Booking booking : bookings) {
                if (!booking.getSession().getId().equals(session.getId())) {
                    continue;
                }
                BookingStatus bs = booking.getBookingStatus();
                if (bs == BookingStatus.CANCELLED || bs == BookingStatus.REJECTED) {
                    continue;
                }
                session.setBookedByLearnerName(booking.getLearner().getFullName());
                session.setBookedByLearnerId(booking.getLearner().getId());
                session.setBookingState(bs.name());
                break;
            }
        }
    }

    private void notifyPublicSessionSubscribers(User mentor, SkillSession saved) {
        Set<Long> subscriberIds = new LinkedHashSet<>();
        savedMentorRepository.findByMentorId(mentor.getId())
                .forEach(item -> subscriberIds.add(item.getLearner().getId()));

        String sessionText = (String.valueOf(saved.getTitle()) + " " + String.valueOf(saved.getSessionType()))
                .toLowerCase(Locale.ROOT);
        // Use bounded paginated fetch to avoid loading all rows
        skillWatchlistRepository.findAll(org.springframework.data.domain.PageRequest.of(0, 2000)).forEach(item -> {
            if (sessionText.contains(item.getSkillName().toLowerCase(Locale.ROOT))) {
                subscriberIds.add(item.getLearner().getId());
            }
        });

        if (!subscriberIds.isEmpty()) {
            notificationService.notifyUsers(
                    subscriberIds,
                    "NEW_SESSION",
                    "New session available",
                    mentor.getFullName() + " posted a new session: " + saved.getTitle(),
                    saved.getId());
        }
    }

    /**
     * Validates that a meeting link is an absolute http(s) URL. Prevents
     * javascript:, data:, or other non-http schemes from being stored (they
     * would otherwise render as clickable links / be opened by window.open in
     * the learner UI). Accepts null/blank for sessions without a link yet.
     */
    private static String normalizeHttpUrl(String url) {
        if (url == null) {
            return null;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new BadRequestException("Meeting link must be an http(s) URL");
        }
        return trimmed;
    }

/**
 * Immutable data carrier for create session request.
 */
    public record CreateSessionRequest(
            String title,
            String description,
            String sessionType,
            Long targetLearnerId,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            BigDecimal priceAmount,
            String meetingLink,
            Integer cancellationWindowHours,
            Integer rescheduleWindowHours,
            Integer maxParticipants,
            Boolean confirmMakePublic) {
    }

/**
 * Immutable data carrier for update meeting link request.
 */
    public record UpdateMeetingLinkRequest(String meetingLink) {
    }
}
