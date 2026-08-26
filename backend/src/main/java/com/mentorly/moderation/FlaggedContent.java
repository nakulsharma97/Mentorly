package com.mentorly.moderation;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.mentorly.safety.ReportPriority;
import com.mentorly.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * A single piece of flagged content in the moderation center. Separate from
 * {@code UserReport} (the manual complaints queue) so automated detection
 * pipelines and content-level flags live in their own table.
 */
/**
 * Encapsulates flagged content.
 */
@Getter
@Setter
@Entity
@Table(name = "flagged_content")
public class FlaggedContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false)
    private ContentType contentType;

    /** Id of the content row that was flagged (session id, review id, message id, …). */
    @Column(name = "content_id")
    private Long contentId;

    /** Human-readable preview of the flagged content (title, bio excerpt, message text, …). */
    @Column(name = "content_preview", columnDefinition = "TEXT")
    private String contentPreview;

    /** The user who owns the flagged content. Nullable — some content has no owner. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    @JsonIgnore
    private User owner;

    /** The user who manually reported the content. Null for auto-detected flags. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id")
    @JsonIgnore
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "detection_source", nullable = false)
    private DetectionSource detectionSource = DetectionSource.MANUAL_REPORT;

    @Column(nullable = false)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportPriority priority = ReportPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ModerationStatus status = ModerationStatus.PENDING_REVIEW;

    /** Confidence (0–1) from automated detection — null for manual reports. */
    @Column(name = "ai_confidence")
    private Double aiConfidence;

    /** Moderator currently assigned to investigate. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_moderator_id")
    @JsonIgnore
    private User assignedModerator;

    /** Investigator-only notes — never exposed to users. */
    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "escalation_level")
    private Integer escalationLevel;

    @Column(name = "escalation_reason", length = 500)
    private String escalationReason;

    @Column(name = "escalated_at")
    private OffsetDateTime escalatedAt;

    /** Soft-delete marker — removed content is hidden, not dropped. */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
