package com.skillswap.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "app_notifications")
public class AppNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User user;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    /** Links this delivery back to its broadcast campaign (null for non-broadcast notifications). */
    @Column(name = "broadcast_id")
    private Long broadcastId;

    /** LOW / MEDIUM / HIGH / CRITICAL — surfaced as a badge in the notification center. */
    @Column(nullable = false)
    private String priority = "MEDIUM";

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @Column(name = "clicked_at")
    private OffsetDateTime clickedAt;

    @Column(name = "dismissed_at")
    private OffsetDateTime dismissedAt;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "action_url", length = 1000)
    private String actionUrl;

    @Column(name = "action_button_text")
    private String actionButtonText;

    /** DELIVERED / FAILED / EXPIRED / DISMISSED — powers the admin delivery tracking. */
    @Column(name = "delivery_status", nullable = false)
    private String deliveryStatus = "DELIVERED";

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
