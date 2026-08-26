package com.mentorly.skill;

import java.time.OffsetDateTime;

/**
 * Shared view of a skill-category request used by both the public
 * {@link SkillController} (submission + own history) and the admin
 * {@link SkillAdminController} (moderation queue).
 */
public record SkillRequestDto(
        Long id,
        String name,
        String category,
        String status,
        Long requestedById,
        String requestedByName,
        String adminNote,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
