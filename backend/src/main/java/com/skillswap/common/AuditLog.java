package com.skillswap.common;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Immutable audit trail entry — one row per recorded event. Entries are
 * created by {@link AuditLogService} (or the admin helpers) and are never
 * updated after insertion; the admin UI treats them as read-only evidence.
 */

@Getter
@Setter
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_user_id", columnList = "user_id"),
        @Index(name = "idx_audit_action", columnList = "action"),
        @Index(name = "idx_audit_created_at", columnList = "created_at")
})
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(name = "user_id")
    private Long userId;

    @Column
    private String resource;

    @Column(name = "resource_id")
    private Long resourceId;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // ── Admin audit fields ──

    @Column(name = "admin_id")
    private Long adminId;

    @Column(name = "admin_email")
    private String adminEmail;

    @Column(name = "entity_type")
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    // ── Activity-timeline metadata (V47) ──

    /** INFO | SUCCESS | WARNING | ERROR | CRITICAL */
    @Column(nullable = false, length = 20)
    private String severity = "INFO";

    /** AUTH | USER | SESSION | SKILL | REPORT | MODERATION | PAYMENT | NOTIFICATION | ADMIN | SYSTEM | SECURITY */
    @Column(length = 40)
    private String module;

    /** SUCCESS | FAILURE */
    @Column(nullable = false, length = 20)
    private String outcome = "SUCCESS";

    @Column(name = "before_value", columnDefinition = "TEXT")
    private String beforeValue;

    @Column(name = "after_value", columnDefinition = "TEXT")
    private String afterValue;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(length = 60)
    private String device;

    @Column(length = 60)
    private String browser;

    @Column(length = 60)
    private String os;

    @Column(name = "request_id", length = 64)
    private String requestId;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(length = 255)
    private String endpoint;

    /** Set when a retention policy archives this entry (kept but hidden from active views). */
    @Column(name = "archived_at")
    private OffsetDateTime archivedAt;

    public AuditLog(String action, String resource, Long resourceId, String details, Long userId, String ipAddress) {
        this.action = action;
        this.resource = resource;
        this.resourceId = resourceId;
        this.details = details;
        this.userId = userId;
        this.ipAddress = ipAddress;
        this.createdAt = OffsetDateTime.now();
    }
}
