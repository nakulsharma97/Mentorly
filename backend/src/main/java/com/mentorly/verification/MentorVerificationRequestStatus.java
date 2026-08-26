package com.mentorly.verification;

/**
 * Enumerates mentor verification request status.
 */
public enum MentorVerificationRequestStatus {
    PENDING,
    /** Admin started reviewing (or the applicant resubmitted after a rejection). */
    UNDER_REVIEW,
    APPROVED,
    REJECTED,
    /** Admin suspended a previously approved mentor (trust & safety). */
    SUSPENDED,
    MORE_INFORMATION_REQUIRED
}
