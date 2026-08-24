package com.skillswap.payout;

import com.skillswap.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Maps to the mentor_connect_accounts table — tracks one Stripe Connect
 * Express account per mentor.
 */
@Getter
@Setter
@Entity
@Table(name = "mentor_connect_accounts")
public class MentorConnectAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "mentor_id", unique = true)
    private User mentor;

    @Column(name = "stripe_account_id", nullable = false, unique = true)
    private String stripeAccountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "onboarding_status", nullable = false, length = 32)
    private OnboardingStatus onboardingStatus = OnboardingStatus.NOT_STARTED;

    @Column(name = "payouts_enabled", nullable = false)
    private boolean payoutsEnabled = false;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
