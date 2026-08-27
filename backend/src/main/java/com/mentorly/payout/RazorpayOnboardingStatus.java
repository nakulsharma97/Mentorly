package com.mentorly.payout;

/**
 * Onboarding status for Razorpay Linked Account (Route).
 */
public enum RazorpayOnboardingStatus {
    /** Onboarding link created, mentor has not completed setup yet */
    PENDING,
    /** Onboarding in progress — details submitted, awaiting verification */
    IN_PROGRESS,
    /** Onboarding complete — payouts enabled */
    COMPLETE,
    /** Account restricted by Razorpay (e.g. missing KYC, compliance issues) */
    RESTRICTED,
    /** Onboarding failed */
    FAILED
}
