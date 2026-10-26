package com.mentorly.stats;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.sitereview.SiteReview;
import com.mentorly.sitereview.SiteReviewRepository;
import com.mentorly.sitereview.SiteReviewStatus;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Service implementing testimonials business logic.
 *
 * <p>The public landing-page list contains ONLY admin-approved site reviews
 * ("Share your review"). Mentor→learner reviews and learner→mentor reviews
 * never appear here: the former lives on the mentor's dashboard/profile, the
 * latter is private between mentor and learner.
 *
 * <p>Cost is a constant two queries regardless of {@code limit}: one page of
 * approved site reviews plus ONE grouped count over the returned author ids
 * (learner-side and mentor-side completed sessions combined). The result is
 * cached under {@link #TESTIMONIALS_CACHE}.
 */
@Service
@RequiredArgsConstructor
public class TestimonialsService {

    /** Cache holding the public testimonials list — evicted on every site-review change. */
    public static final String TESTIMONIALS_CACHE = "testimonials";

    /** DTO {@code source} value: the site_review table ("Share your review"). */
    static final String SOURCE_SITE = "SITE";

    private final SiteReviewRepository siteReviewRepository;
    private final BookingRepository bookingRepository;
    private final CacheManager cacheManager;

    /**
     * The newest approved site reviews, newest first, capped at {@code limit}.
     *
     * @param limit maximum number of reviews to return
     * @return approved site reviews only — never mentor/learner reviews
     */
    @Cacheable(value = TESTIMONIALS_CACHE, key = "#limit")
    public List<ReviewDto> latestApprovedReviews(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        // Repository filters on APPROVED only and orders by createdAt DESC.
        List<SiteReview> approved = siteReviewRepository.findByStatusWithUser(
                SiteReviewStatus.APPROVED, PageRequest.of(0, limit));
        if (approved.isEmpty()) {
            return List.of();
        }

        // ONE grouped query for every returned author — no per-review count.
        Map<Long, Long> completedByAuthor = completedSessionCounts(approved);

        return approved.stream()
                .map(review -> toDto(review, completedByAuthor))
                .sorted(Comparator.comparing(
                        ReviewDto::getReviewDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .toList();
    }

    /**
     * Safety net for the TTL-less ConcurrentMapCacheManager fallback: drop
     * stale entries every 60 seconds so a missed eviction can never keep
     * old reviews visible indefinitely. (Redis entries additionally expire
     * on their configured TTL.)
     */
    @Scheduled(fixedDelayString = "60000")
    public void evictExpiredTestimonialsCache() {
        Cache cache = cacheManager.getCache(TESTIMONIALS_CACHE);
        if (cache != null) {
            cache.clear();
        }
    }

    /** Completed sessions per author id — one grouped query for the whole page. */
    private Map<Long, Long> completedSessionCounts(List<SiteReview> approved) {
        List<Long> authorIds = approved.stream()
                .map(SiteReview::getUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (authorIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = bookingRepository.countCompletedSessionsByUserIdsIn(
                authorIds, BookingStatus.COMPLETED.name());
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }
        return counts;
    }

    private ReviewDto toDto(SiteReview review, Map<Long, Long> completedByAuthor) {
        User author = review.getUser();
        long completed = author == null || author.getId() == null
                ? 0L
                : completedByAuthor.getOrDefault(author.getId(), 0L);
        return new ReviewDto(
                review.getId(),
                author == null ? "" : author.getFullName(),
                author == null ? null : author.getProfileImageUrl(),
                false,
                author == null || author.getRole() == null ? "Learner" : author.getRole().name(),
                "Mentorly platform",
                completed,
                review.getRating(),
                review.getCreatedAt(),
                review.getComment(),
                SOURCE_SITE);
    }
}
