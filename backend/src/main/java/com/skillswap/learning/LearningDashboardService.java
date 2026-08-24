package com.skillswap.learning;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.certification.UserCertification;
import com.skillswap.certification.UserCertificationRepository;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Aggregates the session-based "My Learning" dashboard for a learner.
 *
 * <p>Everything is derived from real data — bookings (the source of truth for
 * completed / upcoming sessions and learning hours), mentor reviews (ratings),
 * certifications, the learner's own todo list, per-session notes and projects.
 * No AI, no recommendations, no fabricated numbers.
 */
@Service
@RequiredArgsConstructor
public class LearningDashboardService {

    /** Booked sessions that count as "upcoming" (requested but not yet started). */
    private static final List<BookingStatus> UPCOMING_STATUSES = List.of(
            BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACCEPTED);

    /** The subset of upcoming sessions that a learner is committed to attending. */
    private static final List<BookingStatus> CONTINUE_UPCOMING_STATUSES = List.of(
            BookingStatus.CONFIRMED, BookingStatus.ACCEPTED);

    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("MMM d");

    private final BookingRepository bookingRepository;
    private final UserCertificationRepository certificationRepository;
    private final LearnerTodoRepository learnerTodoRepository;
    private final SessionNoteRepository sessionNoteRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final UserProjectService userProjectService;

    /* ─────────────────────────── Dashboard ─────────────────────────── */

    @Transactional(readOnly = true)
    public LearningDashboardDtos.DashboardDto getDashboard(User learner) {
        List<Booking> allBookings = bookingRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId());
        OffsetDateTime now = OffsetDateTime.now();

        List<Booking> completed = allBookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.COMPLETED)
                .toList();
        List<Booking> upcoming = allBookings.stream()
                .filter(b -> isUpcoming(b, now))
                .toList();

        long completedSessions = completed.size();
        double learningHours = round1(completed.stream()
                .mapToLong(this::durationMinutes)
                .sum() / 60.0);
        long activeMentors = distinctMentorCount(completed);

        List<UserCertification> certifications =
                certificationRepository.findByUserIdOrderByIssuedAtDesc(learner.getId());
        long notesCreated = sessionNoteRepository.countByLearnerId(learner.getId());

        LearningDashboardDtos.OverviewDto overview = new LearningDashboardDtos.OverviewDto(
                completedSessions, upcoming.size(), learningHours, activeMentors,
                certifications.size(), notesCreated);

        LearningDashboardDtos.ContinueLearningDto continueLearning =
                buildContinueLearning(allBookings, completed, now);

        List<LearningDashboardDtos.TimelineItemDto> timeline =
                buildTimeline(allBookings, certifications, learner);

        List<LearningDashboardDtos.ActiveMentorDto> activeMentorDtos =
                buildActiveMentors(completed, allBookings, now);

        List<LearningDashboardDtos.CalendarItemDto> calendar = upcoming.stream()
                .sorted(Comparator.comparing(b -> b.getSession().getStartTime()))
                .limit(20)
                .map(this::toCalendarItem)
                .toList();

        List<LearningDashboardDtos.TodoDto> todos = learnerTodoRepository
                .findByLearnerIdOrderByCreatedAtDesc(learner.getId()).stream()
                .map(LearningDashboardDtos.TodoDto::from)
                .toList();

        long projectsCompleted = userProjectService.listProjects(learner).size();
        long currentStreak = computeStreak(completed);
        double monthlyHours = round1(completed.stream()
                .filter(this::completedThisMonth)
                .mapToLong(this::durationMinutes)
                .sum() / 60.0);

        LearningDashboardDtos.StatisticsDto statistics = new LearningDashboardDtos.StatisticsDto(
                completedSessions, learningHours, activeMentors,
                certifications.size(), projectsCompleted, notesCreated,
                currentStreak, monthlyHours, upcoming.size());

        List<LearningDashboardDtos.TodoSuggestionDto> todoSuggestions =
                buildTodoSuggestions(allBookings, completed, upcoming, todos, certifications, learner, now);

        List<LearningDashboardDtos.ActivityItemDto> recentActivity =
                buildRecentActivity(allBookings, certifications, todos, learner);

        return new LearningDashboardDtos.DashboardDto(
                learner.getFullName(),
                overview,
                continueLearning,
                timeline,
                activeMentorDtos,
                calendar,
                todos,
                todoSuggestions,
                recentActivity,
                statistics,
                !certifications.isEmpty());
    }

    /* ─────────────────────────── History ─────────────────────────── */

    @Transactional(readOnly = true)
    public LearningDashboardDtos.HistoryPageDto getHistory(User learner, String search, String status,
            int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 50);
        BookingStatus filter = null;
        if (status != null && !status.isBlank()) {
            try {
                filter = BookingStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // Unknown status filter → treated as no filter rather than an error.
            }
        }

        Page<Booking> result = bookingRepository.searchLearnerHistory(
                learner.getId(), filter, search, PageRequest.of(safePage, safeSize));

        Set<Long> bookingIds = result.getContent().stream().map(Booking::getId).collect(Collectors.toSet());
        Set<Long> notedBookingIds = bookingIds.isEmpty()
                ? Set.of()
                : sessionNoteRepository.findByLearnerIdAndBookingIdIn(learner.getId(), bookingIds).stream()
                        .map(n -> n.getBooking().getId())
                        .collect(Collectors.toSet());

        boolean certificatesAvailable =
                !certificationRepository.findByUserIdOrderByIssuedAtDesc(learner.getId()).isEmpty();

        List<LearningDashboardDtos.HistoryItemDto> items = result.getContent().stream()
                .map(b -> toHistoryItem(b, notedBookingIds.contains(b.getId())))
                .toList();

        return new LearningDashboardDtos.HistoryPageDto(
                items, result.getTotalElements(), safePage, safeSize,
                result.getTotalPages(), certificatesAvailable);
    }

    /* ─────────────────────────── Todos ─────────────────────────── */

    @Transactional(readOnly = true)
    public List<LearningDashboardDtos.TodoDto> listTodos(User learner) {
        return learnerTodoRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId()).stream()
                .map(LearningDashboardDtos.TodoDto::from)
                .toList();
    }

    @Transactional
    public LearningDashboardDtos.TodoDto createTodo(User learner, String task) {
        return createTodo(learner, task, false);
    }

    @Transactional
    public LearningDashboardDtos.TodoDto createTodo(User learner, String task, Boolean done) {
        String clean = task == null ? "" : task.trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Task is required");
        }
        if (clean.length() > 500) {
            throw new IllegalArgumentException("Task is too long");
        }
        LearnerTodo todo = new LearnerTodo();
        todo.setLearner(learner);
        todo.setTask(clean);
        todo.setDone(done != null && done);
        OffsetDateTime now = OffsetDateTime.now();
        todo.setCreatedAt(now);
        todo.setUpdatedAt(now);
        return LearningDashboardDtos.TodoDto.from(learnerTodoRepository.save(todo));
    }

    @Transactional
    public LearningDashboardDtos.TodoDto updateTodo(User learner, Long todoId, String task, Boolean done) {
        LearnerTodo todo = requireOwnedTodo(learner, todoId);
        if (task != null) {
            String clean = task.trim();
            if (clean.isEmpty()) {
                throw new IllegalArgumentException("Task is required");
            }
            if (clean.length() > 500) {
                throw new IllegalArgumentException("Task is too long");
            }
            todo.setTask(clean);
        }
        if (done != null) {
            todo.setDone(done);
        }
        todo.setUpdatedAt(OffsetDateTime.now());
        return LearningDashboardDtos.TodoDto.from(learnerTodoRepository.save(todo));
    }

    @Transactional
    public void deleteTodo(User learner, Long todoId) {
        LearnerTodo todo = requireOwnedTodo(learner, todoId);
        learnerTodoRepository.delete(todo);
    }

    /* ─────────────────────────── Notes ─────────────────────────── */

    @Transactional(readOnly = true)
    public LearningDashboardDtos.SessionNoteDto getNote(User learner, Long bookingId) {
        requireOwnedBooking(learner, bookingId);
        return sessionNoteRepository.findByBookingIdAndLearnerId(bookingId, learner.getId())
                .map(LearningDashboardDtos.SessionNoteDto::from)
                .orElse(null);
    }

    @Transactional
    public LearningDashboardDtos.SessionNoteDto saveNote(User learner, Long bookingId, String content) {
        Booking booking = requireOwnedBooking(learner, bookingId);
        String clean = content == null ? "" : content.trim();
        SessionNote note = sessionNoteRepository
                .findByBookingIdAndLearnerId(bookingId, learner.getId())
                .orElseGet(() -> {
                    SessionNote created = new SessionNote();
                    created.setBooking(booking);
                    created.setLearner(learner);
                    created.setCreatedAt(OffsetDateTime.now());
                    return created;
                });
        note.setContent(clean);
        note.setUpdatedAt(OffsetDateTime.now());
        return LearningDashboardDtos.SessionNoteDto.from(sessionNoteRepository.save(note));
    }

    /* ─────────────────────────── Internals ─────────────────────────── */

    private LearnerTodo requireOwnedTodo(User learner, Long todoId) {
        return learnerTodoRepository.findByIdAndLearnerId(todoId, learner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Todo not found"));
    }

    private Booking requireOwnedBooking(User learner, Long bookingId) {
        return bookingRepository.findById(bookingId)
                .filter(b -> b.getLearner() != null && b.getLearner().getId().equals(learner.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
    }

    /* ── Continue Learning (priority 1 → 4) ── */

    private LearningDashboardDtos.ContinueLearningDto buildContinueLearning(
            List<Booking> allBookings, List<Booking> completed, OffsetDateTime now) {
        // Priority 1 — an in-progress session takes over the card.
        Optional<Booking> inProgress = allBookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.IN_PROGRESS)
                .findFirst();
        if (inProgress.isPresent()) {
            Booking booking = inProgress.get();
            return toContinueLearning(booking, "IN_PROGRESS", hasNote(booking));
        }

        // Priority 2 — the next accepted/confirmed upcoming session.
        Optional<Booking> nextUpcoming = allBookings.stream()
                .filter(b -> CONTINUE_UPCOMING_STATUSES.contains(b.getBookingStatus()) && isUpcomingTime(b, now))
                .min(Comparator.comparing(b -> b.getSession().getStartTime()));
        if (nextUpcoming.isPresent()) {
            Booking booking = nextUpcoming.get();
            return toContinueLearning(booking, "UPCOMING", hasNote(booking));
        }

        // Priority 3 — the most recent completed session.
        return completed.stream()
                .max(Comparator.comparing(this::effectiveTime))
                .map(b -> toContinueLearning(b, "COMPLETED", hasNote(b)))
                .orElse(null);
    }

    /* ── Timeline (all learning events, newest first) ── */

    private List<LearningDashboardDtos.TimelineItemDto> buildTimeline(
            List<Booking> allBookings, List<UserCertification> certifications, User learner) {
        List<LearningDashboardDtos.TimelineItemDto> events = new ArrayList<>();

        allBookings.stream().limit(14).forEach(b -> events.add(toTimelineItem(b)));

        sessionNoteRepository.findTop5ByLearnerIdOrderByUpdatedAtDesc(learner.getId())
                .forEach(n -> events.add(new LearningDashboardDtos.TimelineItemDto(
                        n.getBooking().getId(),
                        sessionIdOf(n.getBooking()),
                        "NOTES_ADDED", "Notes Added",
                        titleOf(n.getBooking()),
                        mentorIdOf(n.getBooking()), mentorNameOf(n.getBooking()), mentorPhotoOf(n.getBooking()),
                        n.getUpdatedAt(), null, 0)));

        certifications.stream().limit(5).forEach(c -> events.add(new LearningDashboardDtos.TimelineItemDto(
                null, null, "CERTIFICATE_EARNED", "Certificate Earned", c.getTitle(),
                null, null, null, c.getIssuedAt(), null, 0)));

        return events.stream()
                .sorted(Comparator.comparing(LearningDashboardDtos.TimelineItemDto::eventTime,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(15)
                .toList();
    }

    /* ── Recent activity ── */

    private List<LearningDashboardDtos.ActivityItemDto> buildRecentActivity(
            List<Booking> allBookings,
            List<UserCertification> certifications, List<LearningDashboardDtos.TodoDto> todos,
            User learner) {
        List<LearningDashboardDtos.ActivityItemDto> events = new ArrayList<>();

        allBookings.stream().limit(8).forEach(b -> {
            LearningDashboardDtos.ActivityItemDto event = activityFor(b);
            if (event != null) {
                events.add(event);
            }
        });

        certifications.stream().limit(5).forEach(c -> events.add(new LearningDashboardDtos.ActivityItemDto(
                "CERTIFICATE",
                "Earned a certificate",
                c.getTitle(),
                c.getIssuedAt())));

        todos.stream().limit(5).forEach(t -> {
            if (t.done()) {
                events.add(new LearningDashboardDtos.ActivityItemDto(
                        "TODO_COMPLETED", "Completed a task", t.task(), t.updatedAt()));
            } else {
                events.add(new LearningDashboardDtos.ActivityItemDto(
                        "TODO_ADDED", "Added a task", t.task(), t.createdAt()));
            }
        });

        sessionNoteRepository.findTop5ByLearnerIdOrderByUpdatedAtDesc(learner.getId())
                .forEach(n -> events.add(new LearningDashboardDtos.ActivityItemDto(
                        "NOTE_SAVED", "Saved session notes",
                        titleOf(n.getBooking()), n.getUpdatedAt())));

        return events.stream()
                .sorted(Comparator.comparing(LearningDashboardDtos.ActivityItemDto::timestamp).reversed())
                .limit(15)
                .toList();
    }

    private LearningDashboardDtos.ActivityItemDto activityFor(Booking booking) {
        return switch (booking.getBookingStatus()) {
            case PENDING -> new LearningDashboardDtos.ActivityItemDto(
                    "REQUESTED", "Requested a session", titleOf(booking), booking.getCreatedAt());
            case ACCEPTED, CONFIRMED -> new LearningDashboardDtos.ActivityItemDto(
                    "SCHEDULED", "Scheduled a session", titleOf(booking), timeOrCreated(booking));
            case RESCHEDULE_REQUESTED -> new LearningDashboardDtos.ActivityItemDto(
                    "RESCHEDULED", "Requested a reschedule", titleOf(booking), timeOrCreated(booking));
            case IN_PROGRESS -> new LearningDashboardDtos.ActivityItemDto(
                    "STARTED", "Session in progress", titleOf(booking), timeOrCreated(booking));
            case COMPLETED -> new LearningDashboardDtos.ActivityItemDto(
                    "COMPLETED", "Completed a session", titleOf(booking), effectiveTime(booking));
            case CANCELLED, REJECTED -> new LearningDashboardDtos.ActivityItemDto(
                    "CANCELLED", "Cancelled a session", titleOf(booking), timeOrCreated(booking));
            case REVIEW_REQUIRED -> new LearningDashboardDtos.ActivityItemDto(
                    "REVIEW_REQUIRED", "Session requires review", titleOf(booking), timeOrCreated(booking));
        };
    }

    /* ── Auto-generated todo suggestions ── */

    private List<LearningDashboardDtos.TodoSuggestionDto> buildTodoSuggestions(
            List<Booking> allBookings, List<Booking> completed, List<Booking> upcoming,
            List<LearningDashboardDtos.TodoDto> todos, List<UserCertification> certifications,
            User learner, OffsetDateTime now) {
        Set<String> existing = todos.stream()
                .map(t -> t.task().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        List<LearningDashboardDtos.TodoSuggestionDto> suggestions = new ArrayList<>();

        allBookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.IN_PROGRESS)
                .findFirst()
                .ifPresent(b -> addSuggestion(suggestions, existing, "continue-session",
                        "Continue your in-progress session: " + titleOf(b)));

        long attendCount = 0;
        for (Booking b : allBookings) {
            if (attendCount >= 2) {
                break;
            }
            if (CONTINUE_UPCOMING_STATUSES.contains(b.getBookingStatus())
                    && isUpcomingTime(b, now) && isWithinDays(b.getSession(), now, 14)) {
                String when = b.getSession().getStartTime().format(SHORT_DATE);
                if (addSuggestion(suggestions, existing, "attend-" + b.getId(),
                        "Attend upcoming session: " + titleOf(b) + " (" + when + ")")) {
                    attendCount++;
                }
            }
        }

        completed.stream()
                .filter(b -> !hasNote(b))
                .findFirst()
                .ifPresent(b -> addSuggestion(suggestions, existing, "notes-" + b.getId(),
                        "Add notes for " + titleOf(b)));

        if (!completed.isEmpty() && userProjectService.listProjects(learner).isEmpty()) {
            addSuggestion(suggestions, existing, "upload-project",
                    "Upload a project to showcase your work");
        }

        certifications.stream().findFirst().ifPresent(c -> addSuggestion(suggestions, existing,
                "download-cert", "Download your certificate for " + c.getTitle()));

        if (upcoming.isEmpty()) {
            addSuggestion(suggestions, existing, "book-next",
                    "Book your next session with a mentor");
        }

        return suggestions;
    }

    private boolean addSuggestion(List<LearningDashboardDtos.TodoSuggestionDto> out,
            Set<String> existing, String key, String text) {
        if (existing.contains(text.toLowerCase(Locale.ROOT))) {
            return false;
        }
        out.add(new LearningDashboardDtos.TodoSuggestionDto(key, text));
        return true;
    }

    /* ── Active mentors ── */

    private List<LearningDashboardDtos.ActiveMentorDto> buildActiveMentors(
            List<Booking> completed, List<Booking> allBookings, OffsetDateTime now) {
        Map<Long, Long> sessionsPerMentor = new LinkedHashMap<>();
        Map<Long, User> mentorById = new HashMap<>();
        for (Booking booking : completed) {
            User mentor = booking.getSession() == null ? null : booking.getSession().getMentor();
            if (mentor == null || mentor.getId() == null) {
                continue;
            }
            sessionsPerMentor.merge(mentor.getId(), 1L, Long::sum);
            mentorById.putIfAbsent(mentor.getId(), mentor);
        }

        if (mentorById.isEmpty()) {
            return List.of();
        }

        Map<Long, Long> upcomingPerMentor = new HashMap<>();
        for (Booking booking : allBookings) {
            if (!isUpcoming(booking, now)) {
                continue;
            }
            User mentor = booking.getSession() == null ? null : booking.getSession().getMentor();
            if (mentor == null || mentor.getId() == null) {
                continue;
            }
            upcomingPerMentor.merge(mentor.getId(), 1L, Long::sum);
        }

        Map<Long, Double> ratings = mentorReviewRepository
                .averageRatingByMentorIdsIn(mentorById.keySet()).stream()
                .collect(Collectors.toMap(row -> (Long) row[0],
                        row -> round1(((Number) row[1]).doubleValue()), (a, b) -> a));

        return sessionsPerMentor.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .map(entry -> {
                    User mentor = mentorById.get(entry.getKey());
                    return new LearningDashboardDtos.ActiveMentorDto(
                            mentor.getId(),
                            mentor.getFullName(),
                            mentor.getProfileImageUrl(),
                            specialization(mentor),
                            entry.getValue(),
                            upcomingPerMentor.getOrDefault(mentor.getId(), 0L),
                            ratings.getOrDefault(mentor.getId(), 0.0));
                })
                .toList();
    }

    /* ── Small mapping helpers ── */

    private LearningDashboardDtos.ContinueLearningDto toContinueLearning(Booking booking, String type, boolean hasNote) {
        SkillSession session = booking.getSession();
        User mentor = session == null ? null : session.getMentor();
        return new LearningDashboardDtos.ContinueLearningDto(
                type,
                booking.getId(),
                session == null ? null : session.getId(),
                session == null ? "Session" : session.getTitle(),
                session == null ? null : session.getDescription(),
                mentor == null ? null : mentor.getId(),
                mentor == null ? null : mentor.getFullName(),
                mentor == null ? null : mentor.getProfileImageUrl(),
                durationMinutes(booking),
                booking.getBookingStatus() == BookingStatus.COMPLETED
                        ? effectiveTime(booking)
                        : timeOrCreated(booking),
                session == null ? null : session.getStartTime(),
                booking.getBookingStatus().name(),
                session == null ? null : session.getMeetingLink(),
                session != null && session.canJoin(),
                hasNote);
    }

    private LearningDashboardDtos.TimelineItemDto toTimelineItem(Booking booking) {
        BookingStatus status = booking.getBookingStatus();
        String eventType;
        String eventLabel;
        OffsetDateTime eventTime;
        switch (status) {
            case PENDING -> {
                eventType = "SESSION_REQUESTED";
                eventLabel = "Session Requested";
                eventTime = booking.getCreatedAt();
            }
            case ACCEPTED, CONFIRMED -> {
                eventType = "SESSION_ACCEPTED";
                eventLabel = "Session Accepted";
                eventTime = timeOrCreated(booking);
            }
            case RESCHEDULE_REQUESTED -> {
                eventType = "SESSION_RESCHEDULED";
                eventLabel = "Session Rescheduled";
                eventTime = timeOrCreated(booking);
            }
            case IN_PROGRESS -> {
                eventType = "SESSION_STARTED";
                eventLabel = "Session Started";
                eventTime = timeOrCreated(booking);
            }
            case COMPLETED -> {
                eventType = "SESSION_COMPLETED";
                eventLabel = "Session Completed";
                eventTime = effectiveTime(booking);
            }
            case CANCELLED, REJECTED -> {
                eventType = "SESSION_CANCELLED";
                eventLabel = "Session Cancelled";
                eventTime = timeOrCreated(booking);
            }
            default -> {
                eventType = "SESSION_REQUESTED";
                eventLabel = "Session Requested";
                eventTime = booking.getCreatedAt();
            }
        }
        SkillSession session = booking.getSession();
        User mentor = session == null ? null : session.getMentor();
        return new LearningDashboardDtos.TimelineItemDto(
                booking.getId(),
                session == null ? null : session.getId(),
                eventType, eventLabel,
                session == null ? "Session" : session.getTitle(),
                mentor == null ? null : mentor.getId(),
                mentor == null ? null : mentor.getFullName(),
                mentor == null ? null : mentor.getProfileImageUrl(),
                eventTime,
                status.name(),
                durationMinutes(booking));
    }

    private LearningDashboardDtos.CalendarItemDto toCalendarItem(Booking booking) {
        SkillSession session = booking.getSession();
        User mentor = session == null ? null : session.getMentor();
        return new LearningDashboardDtos.CalendarItemDto(
                booking.getId(),
                session == null ? null : session.getId(),
                session == null ? "Session" : session.getTitle(),
                mentor == null ? null : mentor.getId(),
                mentor == null ? null : mentor.getFullName(),
                session == null ? null : session.getStartTime(),
                session == null ? null : session.getEndTime(),
                session == null ? null : session.getMeetingLink(),
                session != null && session.canJoin(),
                durationMinutes(booking),
                booking.getBookingStatus().name());
    }

    private LearningDashboardDtos.HistoryItemDto toHistoryItem(Booking booking, boolean hasNote) {
        SkillSession session = booking.getSession();
        User mentor = session == null ? null : session.getMentor();
        return new LearningDashboardDtos.HistoryItemDto(
                booking.getId(),
                session == null ? null : session.getId(),
                session == null ? "Session" : session.getTitle(),
                session == null ? null : session.getDescription(),
                mentor == null ? null : mentor.getId(),
                mentor == null ? null : mentor.getFullName(),
                mentor == null ? null : mentor.getProfileImageUrl(),
                timeOrCreated(booking),
                durationMinutes(booking),
                booking.getBookingStatus().name(),
                hasNote);
    }

    private boolean isUpcoming(Booking booking, OffsetDateTime now) {
        return UPCOMING_STATUSES.contains(booking.getBookingStatus()) && isUpcomingTime(booking, now);
    }

    private boolean isUpcomingTime(Booking booking, OffsetDateTime now) {
        SkillSession session = booking.getSession();
        return session != null && session.getStartTime() != null && !session.getStartTime().isBefore(now);
    }

    private boolean isWithinDays(SkillSession session, OffsetDateTime now, int days) {
        return session != null && session.getStartTime() != null
                && !session.getStartTime().isAfter(now.plusDays(days));
    }

    private OffsetDateTime effectiveTime(Booking booking) {
        SkillSession session = booking.getSession();
        if (session != null && session.getEndTime() != null) {
            return session.getEndTime();
        }
        return booking.getCreatedAt();
    }

    private OffsetDateTime timeOrCreated(Booking booking) {
        SkillSession session = booking.getSession();
        if (session != null && session.getStartTime() != null) {
            return session.getStartTime();
        }
        return booking.getCreatedAt();
    }

    private int durationMinutes(Booking booking) {
        SkillSession session = booking.getSession();
        if (session == null || session.getStartTime() == null || session.getEndTime() == null) {
            return 0;
        }
        return (int) Math.max(0,
                java.time.Duration.between(session.getStartTime(), session.getEndTime()).toMinutes());
    }

    private boolean completedThisMonth(Booking booking) {
        OffsetDateTime end = effectiveTime(booking);
        if (end == null) {
            return false;
        }
        OffsetDateTime now = OffsetDateTime.now();
        return end.getYear() == now.getYear() && end.getMonthValue() == now.getMonthValue();
    }

    private long computeStreak(List<Booking> completed) {
        Set<LocalDate> days = new HashSet<>();
        for (Booking booking : completed) {
            OffsetDateTime end = effectiveTime(booking);
            if (end != null) {
                days.add(end.toLocalDate());
            }
        }
        if (days.isEmpty()) {
            return 0;
        }
        LocalDate today = LocalDate.now();
        LocalDate cursor = days.contains(today) ? today : today.minusDays(1);
        if (!days.contains(cursor)) {
            return 0;
        }
        long streak = 0;
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private long distinctMentorCount(List<Booking> bookings) {
        return bookings.stream()
                .map(b -> b.getSession() == null ? null : b.getSession().getMentor())
                .filter(m -> m != null && m.getId() != null)
                .map(User::getId)
                .distinct()
                .count();
    }

    private boolean hasNote(Booking booking) {
        return sessionNoteRepository
                .findByBookingIdAndLearnerId(booking.getId(), booking.getLearner().getId())
                .isPresent();
    }

    private String specialization(User mentor) {
        if (mentor.getHeadline() != null && !mentor.getHeadline().isBlank()) {
            return mentor.getHeadline().trim();
        }
        if (mentor.getSkills() != null && !mentor.getSkills().isBlank()) {
            String first = mentor.getSkills().split("[,;|\\r\\n]+")[0].trim();
            return first.isEmpty() ? "Mentor" : first;
        }
        return "Mentor";
    }

    private String titleOf(Booking booking) {
        SkillSession session = booking.getSession();
        return session == null || session.getTitle() == null ? "a session" : session.getTitle();
    }

    private Long sessionIdOf(Booking booking) {
        return booking.getSession() == null ? null : booking.getSession().getId();
    }

    private Long mentorIdOf(Booking booking) {
        User mentor = booking.getSession() == null ? null : booking.getSession().getMentor();
        return mentor == null ? null : mentor.getId();
    }

    private String mentorNameOf(Booking booking) {
        User mentor = booking.getSession() == null ? null : booking.getSession().getMentor();
        return mentor == null ? null : mentor.getFullName();
    }

    private String mentorPhotoOf(Booking booking) {
        User mentor = booking.getSession() == null ? null : booking.getSession().getMentor();
        return mentor == null ? null : mentor.getProfileImageUrl();
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
