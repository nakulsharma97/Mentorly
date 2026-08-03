package com.skillswap.watchlist;

import com.skillswap.common.ApiClientException;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Encapsulates favorite-mentor (saved-mentor) business logic.
 *
 * <p>Only authenticated learners may manage favorites, and a learner can only
 * ever see or modify their <em>own</em> rows — all queries are scoped by the
 * authenticated user's id, never by an attacker-controlled id. A unique
 * constraint on {@code (learner_id, mentor_id)} plus an explicit existence
 * check prevent duplicate favorites at both the application and database level.
 */
@Service
@RequiredArgsConstructor
public class FavoriteMentorService {

    private final SavedMentorRepository savedMentorRepository;
    private final UserRepository userRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final SessionRepository sessionRepository;

    /** Lists all mentors favorited by the given learner (rich, batched DTOs). */
    @Transactional(readOnly = true)
    public List<SavedMentorDto> listFavorites(User learner) {
        requireLearner(learner);
        List<SavedMentor> saved = savedMentorRepository.findByLearnerId(learner.getId());
        if (saved.isEmpty()) {
            return List.of();
        }

        // Batch enrichment: three grouped queries total (ratings, review counts,
        // min session price) instead of 3*N round trips.
        List<Long> mentorIds = saved.stream()
                .map(s -> s.getMentor().getId())
                .distinct()
                .toList();
        Map<Long, Double> avgRatings = groupLongDouble(
                mentorReviewRepository.averageRatingByMentorIdsIn(mentorIds));
        Map<Long, Long> reviewCounts = groupLongLong(
                mentorReviewRepository.countByMentorIdsIn(mentorIds));
        Map<Long, BigDecimal> minPrices = groupLongDecimal(
                sessionRepository.findMinPriceByMentorIdsIn(mentorIds));

        OffsetDateTime now = OffsetDateTime.now();
        return saved.stream()
                .map(s -> toDto(s, avgRatings, reviewCounts, minPrices, now))
                .toList();
    }

    /** Returns whether the given learner has favorited the given mentor. */
    @Transactional(readOnly = true)
    public boolean isFavorite(User learner, Long mentorId) {
        requireLearner(learner);
        return savedMentorRepository.findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .isPresent();
    }

    /** Adds a mentor to the learner's favorites. Throws on duplicates/self/invalid. */
    @Transactional
    public SavedMentorDto addFavorite(User learner, Long mentorId) {
        requireLearner(learner);
        if (mentorId == null) {
            throw new ApiClientException(HttpStatus.BAD_REQUEST, "BAD_REQUEST",
                    "Mentor id is required", false);
        }
        if (learner.getId().equals(mentorId)) {
            throw new ApiClientException(HttpStatus.BAD_REQUEST, "BAD_REQUEST",
                    "You cannot favorite yourself", false);
        }
        savedMentorRepository.findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .ifPresent(existing -> {
                    throw new ApiClientException(HttpStatus.CONFLICT, "ALREADY_FAVORITED",
                            "Mentor already in favorites", false);
                });

        User mentor = userRepository.findById(mentorId)
                .filter(u -> u.getRole() == UserRole.MENTOR && u.isEnabled())
                .orElseThrow(() -> new ApiClientException(HttpStatus.NOT_FOUND, "MENTOR_NOT_FOUND",
                        "Mentor not found", false));

        SavedMentor saved = new SavedMentor();
        saved.setLearner(learner);
        saved.setMentor(mentor);
        SavedMentor persisted = savedMentorRepository.save(saved);

        return toDto(persisted, Map.of(), Map.of(), Map.of(), OffsetDateTime.now());
    }

    /** Removes a mentor from the learner's favorites. */
    @Transactional
    public boolean removeFavorite(User learner, Long mentorId) {
        requireLearner(learner);
        SavedMentor saved = savedMentorRepository
                .findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .orElseThrow(() -> new ApiClientException(HttpStatus.NOT_FOUND, "FAVORITE_NOT_FOUND",
                        "Mentor is not in your favorites", false));
        savedMentorRepository.delete(saved);
        return true;
    }

    private void requireLearner(User learner) {
        if (learner == null || learner.getRole() != UserRole.LEARNER) {
            throw new ApiClientException(HttpStatus.FORBIDDEN, "FORBIDDEN",
                    "Only learners can manage favorites", false);
        }
    }

    private SavedMentorDto toDto(SavedMentor saved,
            Map<Long, Double> avgRatings,
            Map<Long, Long> reviewCounts,
            Map<Long, BigDecimal> minPrices,
            OffsetDateTime now) {
        User mentor = saved.getMentor();
        Long mentorId = mentor.getId();
        double rating = Math.round((avgRatings.getOrDefault(mentorId, 0.0)) * 10.0) / 10.0;
        long reviews = reviewCounts.getOrDefault(mentorId, 0L);
        boolean liveNow = mentor.getLastActiveAt() != null
                && mentor.getLastActiveAt().isAfter(now.minusMinutes(5));

        return new SavedMentorDto(
                saved.getId(),
                mentorId,
                mentor.getFullName(),
                mentor.getDisplayUsername(),
                mentor.getProfileImageUrl(),
                mentor.getSkills(),
                mentor.getHeadline(),
                mentor.getCompany(),
                mentor.getLanguages(),
                mentor.getHourlyRate(),
                minPrices.get(mentorId),
                mentor.getResponseTimeMinutes(),
                mentor.getYearsOfExperience(),
                rating,
                reviews,
                mentor.isMentorVerified(),
                liveNow,
                saved.getCreatedAt(),
                new SavedMentorDto.MentorView(
                        mentorId,
                        mentor.getFullName(),
                        mentor.getSkills(),
                        mentor.getProfileImageUrl(),
                        rating,
                        reviews,
                        mentor.isMentorVerified(),
                        liveNow));
    }

    private static Map<Long, Double> groupLongDouble(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(
                row -> ((Number) row[0]).longValue(),
                row -> ((Number) row[1]).doubleValue(),
                (a, b) -> a, HashMap::new));
    }

    private static Map<Long, Long> groupLongLong(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(
                row -> ((Number) row[0]).longValue(),
                row -> ((Number) row[1]).longValue(),
                (a, b) -> a, HashMap::new));
    }

    private static Map<Long, BigDecimal> groupLongDecimal(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(
                row -> ((Number) row[0]).longValue(),
                row -> (BigDecimal) row[1],
                (a, b) -> a, HashMap::new));
    }
}
