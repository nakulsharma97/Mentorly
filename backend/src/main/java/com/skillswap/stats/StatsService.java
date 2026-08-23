package com.skillswap.stats;

import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.review.LearnerReviewRepository;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.skill.SkillRepository;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Service implementing stats business logic.
 * <p>
 * The community-stats endpoint runs multiple aggregate queries on every call.
 * To avoid hammering the database with identical requests (e.g. the landing
 * page fires 3 simultaneous calls), results are cached in-memory for
 * {@link #CACHE_TTL_MS} milliseconds.
 */
@Service
@RequiredArgsConstructor
public class StatsService {
    private static final long CACHE_TTL_MS = 30_000;

    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final BookingRepository bookingRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;

    // Simple in-memory cache with TTL — one stats result, shared by all callers.
    private final AtomicReference<CachedStats> cache = new AtomicReference<>();

    private record CachedStats(CommunityStatsDto stats, long timestamp) {}

    public CommunityStatsDto getCommunityStats() {
        CachedStats entry = cache.get();
        if (entry != null && System.currentTimeMillis() - entry.timestamp < CACHE_TTL_MS) {
            return entry.stats();
        }
        long totalUsers = userRepository.count();
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(10);
        long activeUsers = userRepository.countByLastActiveAtAfter(cutoff);
        long skillsOffered = skillRepository.count();
        long completedSwaps = bookingRepository.countByBookingStatus(BookingStatus.COMPLETED);
        long totalBookings = bookingRepository.count();

        // completion rate: percentage of all bookings that reached COMPLETED
        double completionRate = 0.0;
        if (totalBookings > 0) {
            completionRate = Math.round(completedSwaps * 10000.0 / totalBookings) / 100.0;
        }

        // compute overall average rating across mentor and learner reviews
        double mentorAvg = mentorReviewRepository.sumRating();
        long mentorCount = mentorReviewRepository.count();
        double learnerAvgSum = learnerReviewRepository.sumRating();
        long learnerCount = learnerReviewRepository.count();
        double averageRating = 0.0;
        long totalCount = mentorCount + learnerCount;
        if (totalCount > 0) {
            averageRating = (mentorAvg + learnerAvgSum) / (double) totalCount;
        }

        CommunityStatsDto result = new CommunityStatsDto(totalUsers, activeUsers, skillsOffered, completedSwaps,
                Math.round(averageRating * 100.0) / 100.0, completionRate);
        cache.set(new CachedStats(result, System.currentTimeMillis()));
        return result;
    }
}
