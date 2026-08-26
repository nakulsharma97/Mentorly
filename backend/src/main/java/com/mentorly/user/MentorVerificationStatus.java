package com.mentorly.user;

/**
 * Single source of truth for a user's mentor verification state. Stored on the
 * {@code users} table and kept in sync by {@code MentorVerificationService}
 * whenever a verification request is submitted or reviewed.
 *
 * <p>Only {@code APPROVED} mentors are discoverable by learners, may publish
 * availability, create sessions, receive bookings, or accept learner messages.
 */
public enum MentorVerificationStatus {
    /** Fresh account — the mentor has not submitted a verification application yet. */
    NOT_SUBMITTED,
    /** Application submitted — awaiting admin review. */
    PENDING,
    /** Admin started reviewing the application (or the mentor resubmitted after a rejection). */
    UNDER_REVIEW,
    /** Admin approved — the mentor is fully public and can use marketplace features. */
    APPROVED,
    /** Admin rejected the application — {@code rejectionReason} explains why. */
    REJECTED,
    /** Admin requested more information — the mentor must update and resubmit. */
    MORE_INFORMATION_REQUIRED,
    /** Admin suspended a previously approved mentor (trust & safety). */
    SUSPENDED
}
