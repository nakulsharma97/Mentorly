package com.skillswap.sessionrequest;

import com.skillswap.user.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "session_requests")
public class SessionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "learner_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User learner;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "mentor_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User mentor;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column
    private String subject;

    @Column(name = "preferred_date")
    private String preferredDate;

    @Column(name = "preferred_time")
    private String preferredTime;

    @Column(name = "preferred_duration")
    private Integer preferredDuration;

    @Column
    private String budget;

    @Column(name = "decline_reason", columnDefinition = "TEXT")
    private String declineReason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionRequestStatus status = SessionRequestStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "reply_message", columnDefinition = "TEXT")
    private String replyMessage;
}
