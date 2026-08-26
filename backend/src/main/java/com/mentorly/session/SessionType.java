package com.mentorly.session;

/**
 * Visibility class of a 1:1 session instance.
 *
 * <p>Mentorly is a 1:1 mentoring marketplace: ONE session instance belongs
 * to AT MOST ONE learner, regardless of its visibility class.
 *
 * <ul>
 *   <li>{@link #PUBLIC} — discoverable by any eligible learner while it is
 *       available. Once a learner books it, it is no longer discoverable.</li>
 *   <li>{@link #PRIVATE} — created for exactly one learner
 *       ({@code SkillSession.targetLearner}). Only that learner can see,
 *       access, or book it.</li>
 * </ul>
 */
public enum SessionType {
    PUBLIC,
    PRIVATE
}
