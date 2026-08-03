package com.skillswap.skill;

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
