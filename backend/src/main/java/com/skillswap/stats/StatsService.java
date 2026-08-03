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

/**
 * Service implementing stats business logic.
 */
@Service
@RequiredArgsConstructor
public class StatsService {
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final BookingRepository bookingRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;

    public CommunityStatsDto getCommunityStats() {
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

        return new CommunityStatsDto(totalUsers, activeUsers, skillsOffered, completedSwaps,
                Math.round(averageRating * 100.0) / 100.0, completionRate);
    }
}
