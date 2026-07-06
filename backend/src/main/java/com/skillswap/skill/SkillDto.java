package com.skillswap.skill;

public record SkillDto(
        Long id,
        String name,
        String category,
        long mentorCount,
        long learnerCount
) {}
