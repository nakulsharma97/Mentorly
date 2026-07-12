package com.skillswap.booking;

import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.payment.Payment;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

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

    // Payment Status
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // Helper methods
    public boolean isApprovedForJoin() {
        return approvedByAdmin != null && approvedByAdmin && paymentStatus.isCompleted();
    }

    public boolean hasJoined() {
        return joinedAt != null;
    }

    public long getMinutesSinceCreation() {
        return java.time.temporal.ChronoUnit.MINUTES.between(createdAt, OffsetDateTime.now());
    }
}
