package com.skillswap.wallet;

/**
 * Payout status tracking for wallet withdrawals that go through Stripe Connect.
 */
public enum PayoutStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED
}
