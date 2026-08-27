package com.mentorly.payout;

/**
 * Onboarding status for Razorpay Linked Account (Route).
 */
public enum RazorpayOnboardingStatus {
    /** No linked account created yet */
    ONBOARDING_REQUIRED,
    /** Onboarding link created, mentor has not completed setup yet */
    PENDING,
    /** Onboarding in progress — details submitted, awaiting verification */
    IN_PROGRESS,
    /** Account created but product configuration is pending */
    CONFIGURATION_PENDING,
    /** Onboarding complete — payouts enabled */
    COMPLETE,
    /** Account restricted by Razorpay (e.g. missing KYC, compliance issues) */
    RESTRICTED,
    /** Onboarding failed */
    FAILED,
    /** Account suspended by Razorpay */
    SUSPENDED
}
