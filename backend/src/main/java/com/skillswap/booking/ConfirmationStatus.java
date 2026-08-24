package com.skillswap.booking;

/**
 * Confirmation status for each participant in the dual-completion flow.
 * Both learner and mentor independently confirm whether the session happened.
 */
public enum ConfirmationStatus {
    PENDING,
    CONFIRMED,
    DISPUTED
}
