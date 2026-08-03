package com.skillswap.moderation;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
 * Append-only timeline entry for a flagged content item. Records who did what,
 * and the status transition, so the full moderation history is auditable.
 */
/**
 * Encapsulates moderation event.
 */
@Getter
@Setter
@Entity
@Table(name = "flagged_content_events")
public class ModerationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "flagged_content_id")
    @JsonIgnore
    private FlaggedContent flaggedContent;

    /** Action label, e.g. FLAGGED, ASSIGNED, APPROVED, REMOVED, SUSPENDED. */
    @Column(nullable = false)
    private String action;

    /** The moderator who performed the action (null for system-generated events). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    @JsonIgnore
    private User actor;

    @Column(name = "from_status")
    private String fromStatus;

    @Column(name = "to_status")
    private String toStatus;

    @Column(length = 1000)
    private String note;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
