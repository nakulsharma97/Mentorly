package com.mentorly.stats;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.review.LearnerReviewRepository;
import com.mentorly.review.MentorReviewRepository;
import com.mentorly.skill.SkillRepository;
import com.mentorly.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * Service implementing stats business logic.
 * <p>
 * The community-stats endpoint runs multiple aggregate queries on every call.
 * Results are cached via Spring Cache abstraction (Redis in production,
 * in-memory fallback in dev/test) to avoid hammering the database with
 * identical requests from the landing page.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StatsService {

    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final BookingRepository bookingRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final CacheManager cacheManager;

    /**
     * Safety net for the TTL-less in-memory cache used when Redis is off
     * (docker-compose and Render both ship with {@code APP_REDIS_ENABLED}
     * unset): nothing else ever evicts {@code communityStats}, so without this
     * sweep the landing-page counters froze at their first value for the whole
     * life of the process. Redis entries already expire on their 30 s TTL.
     */
    @Scheduled(fixedDelayString = "60000")
    public void evictStaleCommunityStats() {
        Cache cache = cacheManager.getCache("communityStats");
        if (cache != null) {
            cache.clear();
        }
    }

    /**
     * Returns community-wide statistics (users, skills, swaps, ratings).
     * <p>
     * Cached for at most ~60 seconds — the landing page fires 3 simultaneous
     * calls and the data changes infrequently. Cache key: literal "global"
     * since this is site-wide, not user-specific. See
     * {@link #evictStaleCommunityStats()} for the refresh guarantee.
     */
    @Cacheable(value = "communityStats", key = "'global'", unless = "#result == null")
    public CommunityStatsDto getCommunityStats() {
        log.debug("CACHE MISS: computing community stats from database");
        long totalUsers = userRepository.count();
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(10);
        long activeUsers = userRepository.countByLastActiveAtAfter(cutoff);
        long skillsOffered = skillRepository.count();
        long completedSwaps = bookingRepository.countByBookingStatus(BookingStatus.COMPLETED);
        long totalBookings = bookingRepository.count();

        double completionRate = 0.0;
        if (totalBookings > 0) {
            completionRate = Math.round(completedSwaps * 10000.0 / totalBookings) / 100.0;
        }

        double mentorAvg = mentorReviewRepository.sumRating();
        long mentorCount = mentorReviewRepository.count();
        double learnerAvgSum = learnerReviewRepository.sumRating();
        long learnerCount = learnerReviewRepository.count();
        double averageRating = 0.0;
        long totalCount = mentorCount + learnerCount;
        if (totalCount > 0) {
            averageRating = (mentorAvg + learnerAvgSum) / (double) totalCount;
        }

        return new CommunityStatsDto(totalUsers, activeUsers, skillsOffered, completedSwaps,
                Math.round(averageRating * 100.0) / 100.0, completionRate);
    }
}
