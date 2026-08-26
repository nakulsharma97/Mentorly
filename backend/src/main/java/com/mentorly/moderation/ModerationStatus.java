package com.mentorly.moderation;

/**
 * Lifecycle of a flagged content item in the moderation center.
 */
public enum ModerationStatus {
    /** Waiting for a moderator to pick it up. */
    PENDING_REVIEW,
    /** A moderator is actively investigating. */
    UNDER_INVESTIGATION,
    /** Content checked and allowed to stay. */
    APPROVED,
    /** Content removed from the platform. */
    REMOVED,
    /** Flag dismissed as a false positive (no action needed). */
    DISMISSED,
    /** Previously removed content was restored. */
    RESTORED
}
