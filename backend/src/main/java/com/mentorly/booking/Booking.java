package com.mentorly.booking;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.mentorly.payment.PaymentStatus;
import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import com.mentorly.payment.Payment;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Encapsulates booking.
 */
@Getter
@Setter
@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id")
    private SkillSession session;

    @ManyToOne(optional = false)
    @JoinColumn(name = "learner_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User learner;

    @Enumerated(EnumType.STRING)
    @Column(name = "booking_status", nullable = false)
    private BookingStatus bookingStatus = BookingStatus.PENDING;

    @Column(name = "cancel_reason")
    private String cancelReason;

    // Admin Approval Fields
    @Column(name = "approved_by_admin")
    private Boolean approvedByAdmin = false;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "joined_at")
    private OffsetDateTime joinedAt;

    // ── Dual-confirmation session completion ──

    /** Lightweight signal: when the learner requested the join link. */
    @Column(name = "learner_join_link_requested_at")
    private OffsetDateTime learnerJoinLinkRequestedAt;

    /** Lightweight signal: when the mentor confirmed joining. */
    @Column(name = "mentor_join_link_requested_at")
    private OffsetDateTime mentorJoinLinkRequestedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "learner_confirmation_status", nullable = false, length = 32)
    private ConfirmationStatus learnerConfirmationStatus = ConfirmationStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "mentor_confirmation_status", nullable = false, length = 32)
    private ConfirmationStatus mentorConfirmationStatus = ConfirmationStatus.PENDING;

    @Column(name = "learner_confirmed_at")
    private OffsetDateTime learnerConfirmedAt;

    @Column(name = "mentor_confirmed_at")
    private OffsetDateTime mentorConfirmedAt;

    @Column(name = "learner_dispute_reason", columnDefinition = "TEXT")
    private String learnerDisputeReason;

    @Column(name = "mentor_dispute_reason", columnDefinition = "TEXT")
    private String mentorDisputeReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "completion_review_status", nullable = false, length = 32)
    private CompletionReviewStatus completionReviewStatus = CompletionReviewStatus.NOT_APPLICABLE;

    // Payment Status
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    /**
     * EAGER fetch + serialize-safe: with {@code spring.jpa.open-in-view=false},
     * a LAZY proxy here blows up Jackson serialization of every booking list
     * response with {@code LazyInitializationException} once a booking has a
     * payment attached (which is exactly what happens after a session is
     * confirmed / escrow held). EAGER keeps the payment fully initialized
     * inside the transaction so the API can always serialize bookings.
     * Payment is a leaf entity (no back-reference to Booking), so there is no
     * serialization cycle.
     */
    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // Helper methods
    public boolean isApprovedForJoin() {
        if (paymentStatus == null || !paymentStatus.isCompleted()) {
            return false;
        }
        return approvedByAdmin != null && approvedByAdmin;
    }

    public boolean hasJoined() {
        return joinedAt != null;
    }

    public long getMinutesSinceCreation() {
        return java.time.temporal.ChronoUnit.MINUTES.between(createdAt, OffsetDateTime.now());
    }
}
