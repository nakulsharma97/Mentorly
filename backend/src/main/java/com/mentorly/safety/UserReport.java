package com.mentorly.safety;

import com.mentorly.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * Encapsulates user report.
 */
@Getter
@Setter
@Entity
@Table(name = "user_reports")
public class UserReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "reporter_id")
    private User reporter;

    /**
     * The user this report points at (mentor / learner targets). Nullable:
     * session and skill reports have no reported user, so this stays null
     * and {@link #targetLabel} carries the display name instead.
     */
    @ManyToOne(optional = true)
    @JoinColumn(name = "reported_id")
    private User reported;

    @Column(name = "target_type", nullable = false)
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    /** Human-readable label of the reported target (session title, skill name, user full name). */
    @Column(name = "target_label")
    private String targetLabel;

    /** Admin moderation note recorded when the report is resolved or rejected. */
    @Column(name = "moderator_note")
    private String moderatorNote;

    /** Triage priority (LOW / MEDIUM / HIGH / CRITICAL). Defaults to MEDIUM. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportPriority priority = ReportPriority.MEDIUM;

    /**
     * Admin currently assigned to investigate this report (nullable).
     * {@code @JsonIgnore} keeps admin identity out of entity serialization —
     * UserReport is returned directly by learner-facing endpoints, so the
     * assigned admin must only ever surface through the admin DTO endpoints.
     */
    @ManyToOne
    @JoinColumn(name = "assigned_admin_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User assignedAdmin;

    /** Investigator-only notes. Never exposed to users. */
    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    /** Soft-delete marker — spam reports are hidden from queues, not dropped. */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(nullable = false)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportStatus status = ReportStatus.OPEN;

    @Column(name = "escalated", nullable = false)
    private boolean escalated = false;

    @Column(name = "escalation_level")
    private Integer escalationLevel;

    @Column(name = "escalation_reason")
    private String escalationReason;

    @Column(name = "escalated_at")
    private OffsetDateTime escalatedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
