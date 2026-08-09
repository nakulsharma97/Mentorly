package com.skillswap.learning;

import java.time.OffsetDateTime;

/**
 * Immutable DTOs for the learner Daily Tasks feature. Every value comes from
 * the learner's own tasks — nothing is fabricated.
 */
public final class LearnerTaskDtos {

    private LearnerTaskDtos() {
    }

    /**
     * A task as returned to the UI. {@code status} is the effective status:
     * stored {@code TODO}/{@code IN_PROGRESS} becomes {@code OVERDUE} when the
     * due date has passed, so the UI never needs to recompute it.
     */
    public record TaskDto(
            Long id,
            String title,
            String description,
            String type,
            String priority,
            String status,
            OffsetDateTime dueDate,
            OffsetDateTime completedAt,
            Long relatedSessionId,
            Long relatedMentorId,
            String mentorName,
            String sessionTitle,
            boolean systemGenerated,
            OffsetDateTime reminderAt,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {

        static TaskDto from(LearnerTask task, String mentorName, String sessionTitle, OffsetDateTime now) {
            return new TaskDto(
                    task.getId(),
                    task.getTitle(),
                    task.getDescription(),
                    task.getType(),
                    task.getPriority(),
                    effectiveStatus(task, now),
                    task.getDueDate(),
                    task.getCompletedAt(),
                    task.getRelatedSessionId(),
                    task.getRelatedMentorId(),
                    mentorName,
                    sessionTitle,
                    task.isSystemGenerated(),
                    task.getReminderAt(),
                    task.getCreatedAt(),
                    task.getUpdatedAt());
        }
    }

    /**
     * Today's progress numbers plus a simple consistency streak. No XP, no
     * points, no rewards — just completed-task counts.
     */
    public record TaskStatsDto(
            long total,
            long completed,
            long remaining,
            long overdue,
            long todayTotal,
            long todayCompleted,
            long streak) {
    }

    /** Payload for creating a task. Only {@code title} is required. */
    public record TaskCreateRequest(
            String title,
            String description,
            String type,
            String priority,
            OffsetDateTime dueDate,
            Long relatedSessionId,
            Long relatedMentorId,
            Boolean systemGenerated,
            OffsetDateTime reminderAt) {
    }

    /** Payload for updating a task. Every field is optional (partial update). */
    public record TaskUpdateRequest(
            String title,
            String description,
            String type,
            String priority,
            String status,
            OffsetDateTime dueDate,
            Long relatedSessionId,
            Long relatedMentorId,
            OffsetDateTime reminderAt) {
    }

    static String effectiveStatus(LearnerTask task, OffsetDateTime now) {
        String stored = task.getStatus() == null ? "TODO" : task.getStatus();
        if ("COMPLETED".equals(stored) || "CANCELLED".equals(stored)) {
            return stored;
        }
        if (task.getDueDate() != null && task.getDueDate().isBefore(now)) {
            return "OVERDUE";
        }
        return stored;
    }
}
