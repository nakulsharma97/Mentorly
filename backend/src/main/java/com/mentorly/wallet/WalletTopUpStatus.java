package com.mentorly.wallet;

/**
 * Status lifecycle for wallet top-up payments.
 *
 * INITIATED  → top-up created, payment not yet completed
 * VERIFIED   → gateway confirmed payment succeeded (signature/capture verified)
 * SUCCEEDED  → wallet has been credited
 * FAILED     → payment verification failed or payment was rejected
 */
public enum WalletTopUpStatus {
    INITIATED,
    VERIFIED,
    SUCCEEDED,
    FAILED
}
