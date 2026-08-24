package com.skillswap.payout;

/**
 * Onboarding lifecycle states for a Stripe Connect Express account.
 */
public enum OnboardingStatus {
    NOT_STARTED,
    PENDING,
    COMPLETE,
    RESTRICTED
}
