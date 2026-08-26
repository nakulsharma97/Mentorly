package com.mentorly.learning;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Immutable DTOs for the session-based "My Learning" dashboard. Every value is
 * derived from real bookings, sessions, certifications, notes and todos — the
 * platform never fabricates learning data.
 */
public final class LearningDashboardDtos {

    private LearningDashboardDtos() {
    }

    public record OverviewDto(
            long completedSessions,
            long upcomingSessions,
            double learningHours,
            long activeMentors,
            long certificates,
            long notes) {
    }

    /**
     * The single "Continue Learning" card. {@code type} tells the UI which
     * priority matched:
     * <ul>
     *   <li>{@code IN_PROGRESS} — a live session the learner should resume;</li>
     *   <li>{@code UPCOMING} — the next accepted/confirmed booked session;</li>
     *   <li>{@code COMPLETED} — the most recent completed session.</li>
     * </ul>
     */
    public record ContinueLearningDto(
            String type,
            Long bookingId,
            Long sessionId,
            String title,
            String description,
            Long mentorId,
            String mentorName,
            String mentorPhotoUrl,
            int durationMinutes,
            OffsetDateTime date,
            OffsetDateTime startTime,
            String status,
            String meetingLink,
            boolean canJoin,
            boolean hasNote) {
    }

    /**
     * One learning event on the timeline. Events are derived from real records:
     * each booking contributes exactly one status event (requested / accepted /
     * started / completed / cancelled), plus separate events for saved notes and
     * earned certificates.
     */
    public record TimelineItemDto(
            Long bookingId,
            Long sessionId,
            String eventType,
            String eventLabel,
            String topic,
            Long mentorId,
            String mentorName,
            String mentorPhotoUrl,
            OffsetDateTime eventTime,
            String status,
            int durationMinutes) {
    }

    public record ActiveMentorDto(
            Long mentorId,
            String name,
            String photoUrl,
            String specialization,
            long totalSessions,
            long upcomingSessions,
            double rating) {
    }

    public record CalendarItemDto(
            Long bookingId,
            Long sessionId,
            String title,
            Long mentorId,
            String mentorName,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            String meetingLink,
            boolean canJoin,
            int durationMinutes,
            String status) {
    }

    public record TodoDto(
            Long id,
            String task,
            boolean done,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {

        static TodoDto from(LearnerTodo todo) {
            return new TodoDto(todo.getId(), todo.getTask(), todo.isDone(),
                    todo.getCreatedAt(), todo.getUpdatedAt());
        }
    }

    /**
     * A task automatically derived from the learner's real backend state (an
     * upcoming session, a completed session missing notes, an earned
     * certificate, …). Checking one persists it as a normal {@link TodoDto}.
     */
    public record TodoSuggestionDto(
            String key,
            String text) {
    }

    public record ActivityItemDto(
            String type,
            String title,
            String detail,
            OffsetDateTime timestamp) {
    }

    public record StatisticsDto(
            long sessionsCompleted,
            double learningHours,
            long mentorsLearnedFrom,
            long certificatesEarned,
            long projectsCompleted,
            long notesCreated,
            long currentStreak,
            double monthlyHours,
            long upcomingSessions) {
    }

    public record HistoryItemDto(
            Long bookingId,
            Long sessionId,
            String title,
            String description,
            Long mentorId,
            String mentorName,
            String mentorPhotoUrl,
            OffsetDateTime date,
            int durationMinutes,
            String status,
            boolean hasNote) {
    }

    public record HistoryPageDto(
            List<HistoryItemDto> items,
            long total,
            int page,
            int size,
            int totalPages,
            boolean certificatesAvailable) {
    }

    public record SessionNoteDto(
            Long bookingId,
            String content,
            OffsetDateTime updatedAt) {

        static SessionNoteDto from(SessionNote note) {
            return new SessionNoteDto(note.getBooking().getId(), note.getContent(),
                    note.getUpdatedAt());
        }
    }

    public record DashboardDto(
            String learnerName,
            OverviewDto overview,
            ContinueLearningDto continueLearning,
            List<TimelineItemDto> timeline,
            List<ActiveMentorDto> activeMentors,
            List<CalendarItemDto> calendar,
            List<TodoDto> todos,
            List<TodoSuggestionDto> todoSuggestions,
            List<ActivityItemDto> recentActivity,
            StatisticsDto statistics,
            boolean hasCertificates) {
    }
}
