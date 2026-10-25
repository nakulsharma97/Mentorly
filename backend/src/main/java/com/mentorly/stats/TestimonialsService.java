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

    /** DTO {@code source} values — one per backing table. */
    static final String SOURCE_MENTOR_REVIEW = "MENTOR_REVIEW";
    static final String SOURCE_LEARNER_REVIEW = "LEARNER_REVIEW";
    static final String SOURCE_SITE = "SITE";

    /** Max approved site reviews guaranteed a slot in the public list. */
    static final int MAX_SITE_REVIEWS = 3;

    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final BookingRepository bookingRepository;
    private final SiteReviewRepository siteReviewRepository;

    public List<ReviewDto> latestApprovedReviews(int limit) {
        // Fetch recent reviews with JOIN FETCH to avoid N+1 on relationships
        int fetchSize = limit * 3; // Buffer to get enough after cross-type merge
        // Reserve up to MAX_SITE_REVIEWS slots for approved site reviews so a
        // burst of mentor/learner reviews can never crowd them out.
        int siteSlots = Math.min(MAX_SITE_REVIEWS, limit);

        List<ReviewDto> others = new ArrayList<>();

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
            others.add(new ReviewDto(r.getId(),
                    reviewer == null ? "" : reviewer.getFullName(),
                    reviewer == null ? null : reviewer.getProfileImageUrl(),
                    reviewer != null && reviewer.isMentorVerified(),
                    reviewer == null ? "Learner" : reviewer.getRole().name(),
                    skill,
                    completed,
                    r.getRating(),
                    r.getCreatedAt(),
                    r.getComment(),
                    SOURCE_MENTOR_REVIEW));
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
            others.add(new ReviewDto(r.getId(),
                    reviewer == null ? "" : reviewer.getFullName(),
                    reviewer == null ? null : reviewer.getProfileImageUrl(),
                    reviewer != null && reviewer.isMentorVerified(),
                    reviewer == null ? "Mentor" : reviewer.getRole().name(),
                    skill,
                    completed,
                    r.getRating(),
                    r.getCreatedAt(),
                    r.getComment(),
                    SOURCE_LEARNER_REVIEW));
        }

        // Approved platform-wide site reviews ("Share your review") join the
        // same list. The repository returns them newest-first; only the
        // reserved slots are fetched.
        List<ReviewDto> siteItems = new ArrayList<>();
        for (SiteReview sr : siteReviewRepository.findByStatusWithUser(
                SiteReviewStatus.APPROVED, PageRequest.of(0, siteSlots))) {
            var author = sr.getUser();
            long completed = 0;
            if (author != null) {
                completed = bookingRepository.countByLearnerIdAndBookingStatus(author.getId(),
                        BookingStatus.COMPLETED)
                        + bookingRepository.countBySessionMentorIdAndBookingStatus(author.getId(),
                                BookingStatus.COMPLETED);
            }
            siteItems.add(new ReviewDto(sr.getId(),
                    author == null ? "" : author.getFullName(),
                    author == null ? null : author.getProfileImageUrl(),
                    false,
                    author == null || author.getRole() == null ? "Learner" : author.getRole().name(),
                    "Mentorly platform",
                    completed,
                    sr.getRating(),
                    sr.getCreatedAt(),
                    sr.getComment(),
                    SOURCE_SITE));
        }

        // Site reviews first (guaranteed), then fill the remaining slots with
        // the newest mentor/learner reviews, then order the whole selection by
        // date — never by id, since the sources have independent id sequences.
        List<ReviewDto> selected = new ArrayList<>(siteItems);
        int remaining = Math.max(0, limit - selected.size());
        others.sort(Comparator.comparing(ReviewDto::getReviewDate).reversed());
        selected.addAll(others.stream().limit(remaining).collect(Collectors.toList()));

        return selected.stream()
                .sorted(Comparator.comparing(ReviewDto::getReviewDate).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }
}
