package com.skillswap.stats;

import com.skillswap.review.LearnerReview;
import com.skillswap.review.LearnerReviewRepository;
import com.skillswap.review.MentorReview;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.user.UserRepository;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TestimonialsService {
    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    public List<ReviewDto> latestApprovedReviews(int limit) {
        // Note: review tables do not yet have an approval flag in the entities.
        // We will treat existing reviews as approved by default.
        List<ReviewDto> items = new ArrayList<>();

        List<MentorReview> mentorReviews = mentorReviewRepository.findAll();
        for (MentorReview r : mentorReviews) {
            var reviewer = r.getLearner();
            var skill = r.getBooking() != null && r.getBooking().getSession() != null
                    ? r.getBooking().getSession().getTitle()
                    : null;
            long completed = 0;
            if (reviewer != null) {
                // if reviewer is learner, count completed bookings where they were learner
                completed = bookingRepository.countByLearnerIdAndBookingStatus(reviewer.getId(),
                        BookingStatus.COMPLETED);
            }
            items.add(new ReviewDto(r.getId(),
                    reviewer == null ? "" : reviewer.getFullName(),
                    reviewer == null ? null : reviewer.getProfileImageUrl(),
                    reviewer != null && reviewer.isMentorVerified(),
                    reviewer == null ? "Learner" : reviewer.getRole().name(),
                    skill,
                    completed,
                    r.getRating(),
                    r.getCreatedAt(),
                    r.getComment()));
        }

        List<LearnerReview> learnerReviews = learnerReviewRepository.findAll();
        for (LearnerReview r : learnerReviews) {
            var reviewer = r.getMentor();
            var skill = r.getBooking() != null && r.getBooking().getSession() != null
                    ? r.getBooking().getSession().getTitle()
                    : null;
            long completed = 0;
            if (reviewer != null) {
                // if reviewer is mentor, count completed bookings where they were mentor
                completed = bookingRepository.countBySessionMentorIdAndBookingStatus(reviewer.getId(),
                        BookingStatus.COMPLETED);
            }
            items.add(new ReviewDto(r.getId(),
                    reviewer == null ? "" : reviewer.getFullName(),
                    reviewer == null ? null : reviewer.getProfileImageUrl(),
                    reviewer != null && reviewer.isMentorVerified(),
                    reviewer == null ? "Mentor" : reviewer.getRole().name(),
                    skill,
                    completed,
                    r.getRating(),
                    r.getCreatedAt(),
                    r.getComment()));
        }

        return items.stream()
                .sorted(Comparator.comparing(ReviewDto::getReviewDate).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }
}
