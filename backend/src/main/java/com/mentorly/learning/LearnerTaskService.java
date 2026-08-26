package com.mentorly.learning;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.session.SessionRepository;
import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Backs the learner "Daily Tasks" feature.
 *
 * <p>Tasks are fully learner-owned and database-driven. Learners create their
 * own tasks; the platform only ever generates tasks deterministically from real
 * session activity (a completed session missing notes, an upcoming session to
 * prepare for) — never from AI, never randomly.
 */
@Service
@RequiredArgsConstructor
public class LearnerTaskService {

    private static final Logger LOG = LoggerFactory.getLogger(LearnerTaskService.class);

    /** Task types a learner may choose from. */
    static final Set<String> TYPES = Set.of(
            "SESSION_FOLLOWUP", "NOTE_REVIEW", "PRACTICE", "ASSIGNMENT",
            "PROJECT", "READING", "PERSONAL", "OTHER");

    /** Task priorities. */
    static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");

    /** Stored statuses (OVERDUE is derived at read time). */
    static final Set<String> STATUSES = Set.of("TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED");

    private static final Set<BookingStatus> UPCOMING_STATUSES = Set.of(
            BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACCEPTED);

    private final LearnerTaskRepository learnerTaskRepository;
    private final BookingRepository bookingRepository;
    private final SessionNoteRepository sessionNoteRepository;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;

    /* ─────────────────────────── Reads ─────────────────────────── */

    @Transactional(readOnly = true)
    public List<LearnerTaskDtos.TaskDto> listTasks(User learner, String filter) {
        OffsetDateTime now = OffsetDateTime.now();
        Map<Long, String> mentorNames = new HashMap<>();
        Map<Long, String> sessionTitles = new HashMap<>();

        return learnerTaskRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId()).stream()
                .map(task -> toDto(task, mentorNames, sessionTitles, now))
                .filter(dto -> matchesFilter(dto, filter, now))
                .toList();
    }

    @Transactional(readOnly = true)
    public LearnerTaskDtos.TaskDto getTask(User learner, Long taskId) {
        LearnerTask task = requireOwnedTask(learner, taskId);
        OffsetDateTime now = OffsetDateTime.now();
        return LearnerTaskDtos.TaskDto.from(task,
                resolveMentorName(task.getRelatedMentorId()),
                resolveSessionTitle(task.getRelatedSessionId()),
                now);
    }

    @Transactional(readOnly = true)
    public LearnerTaskDtos.TaskStatsDto stats(User learner) {
        OffsetDateTime now = OffsetDateTime.now();
        List<LearnerTask> tasks = learnerTaskRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId());

        long total = tasks.stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .count();
        long completed = tasks.stream()
                .filter(t -> "COMPLETED".equals(t.getStatus()))
                .count();
        long overdue = tasks.stream()
                .filter(t -> "OVERDUE".equals(LearnerTaskDtos.effectiveStatus(t, now)))
                .count();
        long todayTotal = tasks.stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .filter(t -> isDueOn(t, now, LocalDate.now(ZoneId.systemDefault())))
                .count();
        long todayCompleted = tasks.stream()
                .filter(t -> "COMPLETED".equals(t.getStatus()))
                .filter(t -> isCompletedOn(t, LocalDate.now(ZoneId.systemDefault())))
                .count();

        return new LearnerTaskDtos.TaskStatsDto(
                total, completed, Math.max(0, total - completed), overdue,
                todayTotal, todayCompleted, computeStreak(tasks, LocalDate.now(ZoneId.systemDefault())));
    }

    /* ─────────────────────────── Writes ─────────────────────────── */

    @Transactional
    public LearnerTaskDtos.TaskDto createTask(User learner, LearnerTaskDtos.TaskCreateRequest request) {
        String title = request.title() == null ? "" : request.title().trim();
        if (title.isEmpty()) {
            throw new IllegalArgumentException("Task title is required");
        }
        if (title.length() > 200) {
            throw new IllegalArgumentException("Task title is too long");
        }

        // Optional references are validated only when provided — a personal
        // task never needs a session or mentor. Failures return meaningful
        // messages ("Session not found" / "Mentor not found"), never a generic
        // 404, so the UI can surface the real problem.
        if (request.relatedSessionId() != null) {
            sessionRepository.findById(request.relatedSessionId())
                    .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        }
        if (request.relatedMentorId() != null) {
            User mentor = userRepository.findById(request.relatedMentorId())
                    .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));
            if (mentor.getRole() != UserRole.MENTOR) {
                throw new IllegalArgumentException("Mentor not found");
            }
        }

        LearnerTask task = new LearnerTask();
        task.setLearner(learner);
        task.setTitle(title);
        task.setDescription(trimToNull(request.description(), 4000));
        task.setType(validType(request.type()));
        task.setPriority(validPriority(request.priority()));
        task.setStatus("TODO");
        task.setDueDate(request.dueDate());
        task.setRelatedSessionId(request.relatedSessionId());
        task.setRelatedMentorId(request.relatedMentorId());
        task.setSystemGenerated(Boolean.TRUE.equals(request.systemGenerated()));
        task.setReminderAt(request.reminderAt());
        OffsetDateTime now = OffsetDateTime.now();
        task.setCreatedAt(now);
        task.setUpdatedAt(now);

        LearnerTask saved = learnerTaskRepository.save(task);
        LOG.info("[DailyTask] Task created userId={} taskId={} type={}", learner.getId(), saved.getId(), saved.getType());
        return toDto(saved, new HashMap<>(), new HashMap<>(), now);
    }

    @Transactional
    public LearnerTaskDtos.TaskDto updateTask(User learner, Long taskId,
            LearnerTaskDtos.TaskUpdateRequest request) {
        LearnerTask task = requireOwnedTask(learner, taskId);

        if (request.title() != null) {
            String title = request.title().trim();
            if (title.isEmpty()) {
                throw new IllegalArgumentException("Task title is required");
            }
            if (title.length() > 200) {
                throw new IllegalArgumentException("Task title is too long");
            }
            task.setTitle(title);
        }
        if (request.description() != null) {
            task.setDescription(trimToNull(request.description(), 4000));
        }
        if (request.type() != null) {
            task.setType(validType(request.type()));
        }
        if (request.priority() != null) {
            task.setPriority(validPriority(request.priority()));
        }
        if (request.status() != null) {
            String status = request.status().trim().toUpperCase(Locale.ROOT);
            if (!STATUSES.contains(status)) {
                throw new IllegalArgumentException("Invalid task status: " + request.status());
            }
            task.setStatus(status);
            task.setCompletedAt("COMPLETED".equals(status) ? OffsetDateTime.now() : null);
        }
        if (request.dueDate() != null) {
            task.setDueDate(request.dueDate());
        }
        if (request.relatedSessionId() != null) {
            task.setRelatedSessionId(request.relatedSessionId());
        }
        if (request.relatedMentorId() != null) {
            task.setRelatedMentorId(request.relatedMentorId());
        }
        if (request.reminderAt() != null) {
            task.setReminderAt(request.reminderAt());
        }
        task.setUpdatedAt(OffsetDateTime.now());

        LearnerTask saved = learnerTaskRepository.save(task);
        LOG.info("[DailyTask] Task updated userId={} taskId={}", learner.getId(), saved.getId());
        return toDto(saved, new HashMap<>(), new HashMap<>(), OffsetDateTime.now());
    }

    @Transactional
    public LearnerTaskDtos.TaskDto setCompleted(User learner, Long taskId, boolean completed) {
        LearnerTask task = requireOwnedTask(learner, taskId);
        if (completed) {
            task.setStatus("COMPLETED");
            task.setCompletedAt(OffsetDateTime.now());
        } else {
            task.setStatus("TODO");
            task.setCompletedAt(null);
        }
        task.setUpdatedAt(OffsetDateTime.now());
        LearnerTask saved = learnerTaskRepository.save(task);
        LOG.info("[DailyTask] Task {} userId={} taskId={}",
                completed ? "completed" : "reopened", learner.getId(), saved.getId());
        return toDto(saved, new HashMap<>(), new HashMap<>(), OffsetDateTime.now());
    }

    @Transactional
    public void deleteTask(User learner, Long taskId) {
        LearnerTask task = requireOwnedTask(learner, taskId);
        learnerTaskRepository.delete(task);
        LOG.info("[DailyTask] Task deleted userId={} taskId={}", learner.getId(), taskId);
    }

    /* ─────────────────── Deterministic session follow-ups ─────────────────── */

    /**
     * Generates follow-up tasks from the learner's real session activity.
     * Deterministic and idempotent: a task is only created when the underlying
     * fact is true and no equivalent open task already exists.
     *
     * <ul>
     *   <li>Completed session with no saved note → "Review notes from …"</li>
     *   <li>Upcoming session within 7 days → "Prepare questions for …"</li>
     * </ul>
     */
    @Transactional
    public List<LearnerTaskDtos.TaskDto> generateFromSessions(User learner) {
        OffsetDateTime now = OffsetDateTime.now();
        List<LearnerTask> existing = learnerTaskRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId());
        Set<String> openTitles = existing.stream()
                .filter(t -> !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus()))
                .map(t -> t.getTitle().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        List<LearnerTask> created = new ArrayList<>();
        Map<Long, String> mentorNames = new HashMap<>();
        Map<Long, String> sessionTitles = new HashMap<>();

        for (Booking booking : bookingRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId())) {
            SkillSession session = booking.getSession();
            if (session == null) {
                continue;
            }
            User mentor = session.getMentor();

            // Completed session without notes → review task.
            if (booking.getBookingStatus() == BookingStatus.COMPLETED
                    && sessionNoteRepository.findByBookingIdAndLearnerId(booking.getId(), learner.getId()).isEmpty()) {
                String title = "Review notes from " + session.getTitle();
                if (!openTitles.contains(title.toLowerCase(Locale.ROOT))) {
                    created.add(buildSystemTask(learner, title, "NOTE_REVIEW", "MEDIUM",
                            now.plusDays(2), session, mentor));
                }
            }

            // Upcoming session inside 7 days → preparation task.
            if (UPCOMING_STATUSES.contains(booking.getBookingStatus())
                    && session.getStartTime() != null
                    && !session.getStartTime().isBefore(now)
                    && !session.getStartTime().isAfter(now.plusDays(7))) {
                String title = "Prepare questions for " + session.getTitle();
                if (!openTitles.contains(title.toLowerCase(Locale.ROOT))) {
                    created.add(buildSystemTask(learner, title, "SESSION_FOLLOWUP", "HIGH",
                            session.getStartTime().minusDays(1), session, mentor));
                }
            }
        }

        List<LearnerTaskDtos.TaskDto> dtos = new ArrayList<>();
        for (LearnerTask task : created) {
            LearnerTask saved = learnerTaskRepository.save(task);
            LOG.info("[DailyTask] Generated from session userId={} taskId={} type={}",
                    learner.getId(), saved.getId(), saved.getType());
            dtos.add(toDto(saved, mentorNames, sessionTitles, now));
        }
        return dtos;
    }

    /* ─────────────────────────── Internals ─────────────────────────── */

    private LearnerTask buildSystemTask(User learner, String title, String type, String priority,
            OffsetDateTime dueDate, SkillSession session, User mentor) {
        LearnerTask task = new LearnerTask();
        task.setLearner(learner);
        task.setTitle(title);
        task.setType(type);
        task.setPriority(priority);
        task.setStatus("TODO");
        task.setDueDate(dueDate);
        task.setRelatedSessionId(session.getId());
        task.setRelatedMentorId(mentor == null ? null : mentor.getId());
        task.setSystemGenerated(true);
        OffsetDateTime now = OffsetDateTime.now();
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        return task;
    }

    private LearnerTask requireOwnedTask(User learner, Long taskId) {
        return learnerTaskRepository.findByIdAndLearnerId(taskId, learner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));
    }

    private LearnerTaskDtos.TaskDto toDto(LearnerTask task,
            Map<Long, String> mentorNames, Map<Long, String> sessionTitles, OffsetDateTime now) {
        return LearnerTaskDtos.TaskDto.from(task,
                resolveMentorName(task.getRelatedMentorId(), mentorNames),
                resolveSessionTitle(task.getRelatedSessionId(), sessionTitles),
                now);
    }

    private String resolveMentorName(Long mentorId) {
        return resolveMentorName(mentorId, new HashMap<>());
    }

    private String resolveMentorName(Long mentorId, Map<Long, String> cache) {
        if (mentorId == null) {
            return null;
        }
        return cache.computeIfAbsent(mentorId, id -> userRepository.findById(id)
                .map(User::getFullName)
                .orElse(null));
    }

    private String resolveSessionTitle(Long sessionId) {
        return resolveSessionTitle(sessionId, new HashMap<>());
    }

    private String resolveSessionTitle(Long sessionId, Map<Long, String> cache) {
        if (sessionId == null) {
            return null;
        }
        return cache.computeIfAbsent(sessionId, id -> sessionRepository.findById(id)
                .map(SkillSession::getTitle)
                .orElse(null));
    }

    private boolean matchesFilter(LearnerTaskDtos.TaskDto dto, String filter, OffsetDateTime now) {
        if (filter == null || filter.isBlank() || "ALL".equalsIgnoreCase(filter)) {
            return true;
        }
        return switch (filter.trim().toUpperCase(Locale.ROOT)) {
            case "TODAY" -> dto.dueDate() != null && isDueOnDay(dto.dueDate(), LocalDate.now(ZoneId.systemDefault()));
            case "UPCOMING" -> dto.dueDate() != null
                    && !dto.dueDate().toLocalDate().isBefore(LocalDate.now(ZoneId.systemDefault()))
                    && !"COMPLETED".equals(dto.status()) && !"CANCELLED".equals(dto.status());
            case "COMPLETED" -> "COMPLETED".equals(dto.status());
            case "OVERDUE" -> "OVERDUE".equals(dto.status());
            case "PERSONAL" -> !dto.systemGenerated();
            case "SESSION_TASKS" -> dto.systemGenerated();
            default -> true;
        };
    }

    private boolean isDueOn(LearnerTask task, OffsetDateTime now, LocalDate day) {
        return task.getDueDate() != null && isDueOnDay(task.getDueDate(), day);
    }

    private boolean isDueOnDay(OffsetDateTime dueDate, LocalDate day) {
        return dueDate.toLocalDate().equals(day);
    }

    private boolean isCompletedOn(LearnerTask task, LocalDate day) {
        return task.getCompletedAt() != null && task.getCompletedAt().toLocalDate().equals(day);
    }

    /**
     * Consecutive-day streak of completed tasks (ending today or yesterday).
     * Pure consistency metric — no points or rewards attached.
     */
    private long computeStreak(List<LearnerTask> tasks, LocalDate today) {
        Set<LocalDate> days = tasks.stream()
                .filter(t -> "COMPLETED".equals(t.getStatus()) && t.getCompletedAt() != null)
                .map(t -> t.getCompletedAt().toLocalDate())
                .collect(Collectors.toSet());
        if (days.isEmpty()) {
            return 0;
        }
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

    private String validType(String type) {
        if (type == null || type.isBlank()) {
            return "PERSONAL";
        }
        String clean = type.trim().toUpperCase(Locale.ROOT);
        return TYPES.contains(clean) ? clean : "OTHER";
    }

    private String validPriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "MEDIUM";
        }
        String clean = priority.trim().toUpperCase(Locale.ROOT);
        return PRIORITIES.contains(clean) ? clean : "MEDIUM";
    }

    private String trimToNull(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String clean = value.trim();
        if (clean.isEmpty()) {
            return null;
        }
        return clean.length() > maxLength ? clean.substring(0, maxLength) : clean;
    }
}
