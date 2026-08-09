package com.skillswap.learning;

import com.skillswap.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A single item on a learner's personal daily-task list.
 *
 * <p>Tasks are fully learner-owned and scoped per learner — one learner can
 * never read or modify another's tasks. Every task carries a type, priority and
 * status; {@code OVERDUE} is derived at read time from {@link #dueDate} and the
 * stored status, so no background job is required.
 */
@Getter
@Setter
@Entity
@Table(name = "learner_tasks")
public class LearnerTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    private User learner;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 4000)
    private String description;

    @Column(name = "task_type", nullable = false, length = 32)
    private String type = "PERSONAL";

    @Column(nullable = false, length = 16)
    private String priority = "MEDIUM";

    @Column(nullable = false, length = 16)
    private String status = "TODO";

    @Column(name = "due_date")
    private OffsetDateTime dueDate;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "related_session_id")
    private Long relatedSessionId;

    @Column(name = "related_mentor_id")
    private Long relatedMentorId;

    @Column(name = "is_system_generated", nullable = false)
    private boolean systemGenerated = false;

    @Column(name = "reminder_at")
    private OffsetDateTime reminderAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
