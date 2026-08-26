package com.mentorly.watchlist;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Immutable data carrier for a saved (favorited) mentor.
 *
 * <p>This DTO intentionally never embeds the raw {@link com.mentorly.user.User}
 * entity. Serializing the entity graph directly triggers Jackson infinite
 * recursion ({@code User -> projectsList -> UserProject -> user -> ...}) which
 * surfaced as a 500 on the watchlist endpoints. The DTO flattens the mentor's
 * profile fields instead, and also exposes a backward-compatible nested
 * {@code mentor} view so existing frontend consumers
 * ({@code item.mentor.id ?? item.mentorId ?? item.id}) keep working unchanged.
 */
public record SavedMentorDto(
        Long id,
        Long mentorId,
        String mentorName,
        String username,
        String profileImageUrl,
        String skills,
        String headline,
        String company,
        String languages,
        BigDecimal hourlyRate,
        BigDecimal minSessionPrice,
        Integer responseTimeMinutes,
        Integer yearsOfExperience,
        Double averageRating,
        Long totalReviews,
        boolean mentorVerified,
        boolean liveNow,
        OffsetDateTime createdAt,
        MentorView mentor) {

    /**
     * Lightweight nested mentor view, mirroring the shape previously exposed
     * through the raw entity so existing dashboard/saved-mentor consumers do
     * not need to change their field lookups.
     */
    public record MentorView(
            Long id,
            String fullName,
            String skills,
            String profileImageUrl,
            Double averageRating,
            Long totalReviews,
            boolean mentorVerified,
            boolean liveNow) {
    }
}
