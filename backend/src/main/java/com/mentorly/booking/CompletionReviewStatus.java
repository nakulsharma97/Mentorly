package com.mentorly.booking;

/**
 * Overall completion review status for a booking that has ended.
 * Tracks the lifecycle from awaiting confirmation through to resolution.
 */
public enum CompletionReviewStatus {
    NOT_APPLICABLE,
    AWAITING_CONFIRMATION,
    REVIEW_REQUIRED,
    DISPUTED,
    RESOLVED
}
