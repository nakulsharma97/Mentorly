package com.mentorly.skill;

/**
 * Immutable data carrier for skill.
 */
public record SkillDto(
        Long id,
        String name,
        String category,
        long mentorCount,
        long learnerCount
) { }
