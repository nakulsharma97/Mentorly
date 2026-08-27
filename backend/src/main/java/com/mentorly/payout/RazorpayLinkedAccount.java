package com.mentorly.payout;

import com.mentorly.user.User;
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
 * Tracks Razorpay Linked Account (Route) for mentor payouts.
 * Each mentor can have one Razorpay Linked Account for receiving payouts.
 */
@Getter
@Setter
@Entity
@Table(name = "razorpay_linked_accounts")
public class RazorpayLinkedAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "mentor_id", unique = true)
    private User mentor;

    /** Razorpay Linked Account ID (e.g. acc_PAblzC2xcNwKA2) */
    @Column(name = "razorpay_account_id", nullable = false, unique = true, length = 100)
    private String razorpayAccountId;

    /** Razorpay reference ID — unique business identifier for the linked account */
    @Column(name = "reference_id", length = 255)
    private String referenceId;

    /** Onboarding status on Razorpay */
    @Enumerated(EnumType.STRING)
    @Column(name = "onboarding_status", nullable = false, length = 32)
    private RazorpayOnboardingStatus onboardingStatus = RazorpayOnboardingStatus.PENDING;

    /** Whether payouts are enabled on this linked account */
    @Column(name = "payouts_enabled", nullable = false)
    private boolean payoutsEnabled = false;

    /** Whether the account is activated for transfers */
    @Column(name = "activated", nullable = false)
    private boolean activated = false;

    /** Product configuration status — Razorpay Route requires product config */
    @Column(name = "product_config_status", length = 32)
    private String productConfigStatus = "NOT_CONFIGURED";

    /** Timestamp of last status sync from Razorpay */
    @Column(name = "last_synced_at")
    private OffsetDateTime lastSyncedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
