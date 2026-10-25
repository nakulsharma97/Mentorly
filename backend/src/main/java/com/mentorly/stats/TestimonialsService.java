package com.mentorly.stats;

import com.mentorly.review.LearnerReview;
import com.mentorly.review.LearnerReviewRepository;
import com.mentorly.review.MentorReview;
import com.mentorly.review.MentorReviewRepository;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.sitereview.SiteReview;
import com.mentorly.sitereview.SiteReviewRepository;
import com.mentorly.sitereview.SiteReviewStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service implementing testimonials business logic.
 */
@Service
@RequiredArgsConstructor
public class TestimonialsService {
    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final BookingRepository bookingRepository;
    private final SiteReviewRepository siteReviewRepository;

    public List<ReviewDto> latestApprovedReviews(int limit) {
        // Fetch recent reviews with JOIN FETCH to avoid N+1 on relationships
        int fetchSize = limit * 3; // Buffer to get enough after cross-type merge
        List<ReviewDto> items = new ArrayList<>();

        List<MentorReview> mentorReviews = mentorReviewRepository
                .findAllWithRelations(PageRequest.of(0, fetchSize));
        for (MentorReview r : mentorReviews) {
            var reviewer = r.getLearner();
            var skill = r.getBooking() != null && r.getBooking().getSession() != null
                    ? r.getBooking().getSession().getTitle()
                    : null;
            long completed = 0;
            if (reviewer != null) {
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

        List<LearnerReview> learnerReviews = learnerReviewRepository
                .findAllWithRelations(PageRequest.of(0, fetchSize));
        for (LearnerReview r : learnerReviews) {
            var reviewer = r.getMentor();
            var skill = r.getBooking() != null && r.getBooking().getSession() != null
                    ? r.getBooking().getSession().getTitle()
                    : null;
            long completed = 0;
            if (reviewer != null) {
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

        // Approved platform-wide site reviews ("Share your review") join the same list.
        for (SiteReview sr : siteReviewRepository.findByStatusWithUser(
                SiteReviewStatus.APPROVED, PageRequest.of(0, fetchSize))) {
            var author = sr.getUser();
            long completed = 0;
            if (author != null) {
                completed = bookingRepository.countByLearnerIdAndBookingStatus(author.getId(),
                        BookingStatus.COMPLETED)
                        + bookingRepository.countBySessionMentorIdAndBookingStatus(author.getId(),
                                BookingStatus.COMPLETED);
            }
            items.add(new ReviewDto(sr.getId(),
                    author == null ? "" : author.getFullName(),
                    author == null ? null : author.getProfileImageUrl(),
                    false,
                    author == null || author.getRole() == null ? "Learner" : author.getRole().name(),
                    "Mentorly platform",
                    completed,
                    sr.getRating(),
                    sr.getCreatedAt(),
                    sr.getComment()));
        }

        return items.stream()
                .sorted(Comparator.comparing(ReviewDto::getReviewDate).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }
}
