package com.mentorly.skill;

/**
 * Lifecycle of a skill-category request submitted by a user.
 * PENDING requests appear in the admin moderation queue; approval
 * creates (or confirms) the Skill catalog entry, rejection records the
 * admin's reason and notifies the requester.
 */
public enum SkillRequestStatus {
    PENDING,
    APPROVED,
    REJECTED
}
