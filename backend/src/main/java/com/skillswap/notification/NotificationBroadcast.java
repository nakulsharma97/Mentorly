package com.skillswap.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A broadcast campaign created by an admin. Each campaign fans out one
 * {@code AppNotification} per targeted user through the existing
 * notification pipeline (DB + WebSocket push), then tracks delivery,
 * read, click, and dismissal counts for the admin notification center.
 */
@Getter
@Setter
@Entity
@Table(name = "notification_broadcasts")
public class NotificationBroadcast {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_SCHEDULED = "SCHEDULED";
    public static final String STATUS_SENDING = "SENDING";
    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_ARCHIVED = "ARCHIVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private String subtitle;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false)
    private String type = "ANNOUNCEMENT";

    @Column(nullable = false)
    private String priority = "MEDIUM";

    /** DRAFT / SCHEDULED / SENDING / SENT / CANCELLED / FAILED / ARCHIVED */
    @Column(nullable = false)
    private String status = STATUS_DRAFT;

    /**
     * Who receives the broadcast. One of:
     * ALL, MENTORS, LEARNERS, VERIFIED_MENTORS, UNVERIFIED_MENTORS,
     * SPECIFIC_USERS, ROLES, SKILLS, SESSION_PARTICIPANTS, VERIFICATION_REQUESTS
     */
    @Column(name = "target_scope", nullable = false)
    private String targetScope = "ALL";

    /** Optional JSON payload for the target scope (user ids, roles, skill, session ids, …). */
    @Column(name = "target_detail", columnDefinition = "TEXT")
    private String targetDetail;

    /** When a scheduled broadcast should fire. Null = send immediately. */
    @Column(name = "schedule_time")
    private OffsetDateTime scheduleTime;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    /** NONE / DAILY / WEEKLY / MONTHLY — the scheduler re-queues on completion. */
    @Column(name = "repeat_type", nullable = false)
    private String repeatType = "NONE";

    @Column(name = "action_button_text")
    private String actionButtonText;

    @Column(name = "action_url", length = 1000)
    private String actionUrl;

    @Column(name = "total_targets", nullable = false)
    private int totalTargets = 0;

    @Column(name = "delivered_count", nullable = false)
    private int deliveredCount = 0;

    @Column(name = "read_count", nullable = false)
    private int readCount = 0;

    @Column(name = "clicked_count", nullable = false)
    private int clickedCount = 0;

    @Column(name = "failed_count", nullable = false)
    private int failedCount = 0;

    /**
     * EAGER so admin DTOs built outside a transaction (open-in-view is off)
     * can read the creator without a LazyInitializationException. The join is
     * cheap — a single admin user per broadcast.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "created_by")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @Column(name = "archived_at")
    private OffsetDateTime archivedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
