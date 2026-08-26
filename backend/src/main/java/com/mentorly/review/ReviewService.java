package com.mentorly.review;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.notification.NotificationService;
import com.mentorly.payment.PaymentStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.mentorly.review.ReviewDtos.EligibleBookingResponse;
import com.mentorly.review.ReviewDtos.ReviewItemResponse;
import com.mentorly.review.ReviewDtos.ReviewSummaryResponse;

/**
 * Service implementing review business logic.
 * Handles creation, querying, and validation of mentor and learner reviews.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ProfileCompletionGuard profileCompletionGuard;

    // ════════════════════════════════════════════════
    //  Learner → Mentor Review
    // ════════════════════════════════════════════════

    /**
     * Create a mentor review (learner reviews a mentor after a completed session).
     */
    @Transactional
    @CacheEvict(value = {"mentorReviews", "mentorRating"}, key = "#mentorId")
    public MentorReview createMentorReview(User learner, Long bookingId, Long mentorId,
            Integer rating, String comment) {
        profileCompletionGuard.requireProfileCompleted(learner,
                "Please complete your profile before writing reviews.");

        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!booking.getLearner().getId().equals(learner.getId())) {
            throw new IllegalArgumentException("You can only review your own bookings");
        }
        if (booking.getBookingStatus() != BookingStatus.COMPLETED) {
            throw new IllegalArgumentException("Review is only allowed for completed bookings");
        }
        if (mentorReviewRepository.existsByBookingId(booking.getId())) {
            throw new IllegalArgumentException("Review already submitted for this booking");
        }

        User mentor = userRepository.findById(mentorId)
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));

        if (!booking.getSession().getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("Booking does not belong to this mentor");
        }

        MentorReview review = new MentorReview();
        review.setBooking(booking);
        review.setMentor(mentor);
        review.setLearner(learner);
        review.setRating(rating);
        review.setComment(trimToNull(comment));

        MentorReview saved = mentorReviewRepository.save(review);

        notificationService.notifyUser(
                mentor.getId(),
                "NEW_REVIEW",
                "You received a new mentor review",
                learner.getFullName() + " rated your session " + rating + "/5",
                saved.getId());

        return saved;
    }

    // ════════════════════════════════════════════════
    //  Mentor → Learner Review
    // ════════════════════════════════════════════════

    /**
     * Create a learner review (mentor reviews a learner after a completed session).
     */
    @Transactional
    @CacheEvict(value = {"mentorReviews", "mentorRating"}, key = "#mentorId")
    public LearnerReview createLearnerReview(User mentor, Long bookingId, Long learnerId,
            Integer rating, String comment) {
        profileCompletionGuard.requireProfileCompleted(mentor,
                "Please complete your profile before writing reviews.");

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        User learner = userRepository.findById(learnerId)
                .orElseThrow(() -> new IllegalArgumentException("Learner not found"));

        if (!booking.getSession().getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("Only the mentor from this booking can submit learner review");
        }
        if (!booking.getLearner().getId().equals(learner.getId())) {
            throw new IllegalArgumentException("Booking does not belong to this learner");
        }
        if (!BookingStatus.COMPLETED.equals(booking.getBookingStatus())) {
            throw new IllegalArgumentException("Only completed bookings can be reviewed");
        }
        if (learnerReviewRepository.existsByBookingId(booking.getId())) {
            throw new IllegalArgumentException("Learner review already exists for this booking");
        }

        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }

        LearnerReview review = new LearnerReview();
        review.setBooking(booking);
        review.setMentor(mentor);
        review.setLearner(learner);
        review.setRating(rating);
        review.setComment(comment == null ? null : comment.trim());

        LearnerReview saved = learnerReviewRepository.save(review);

        notificationService.notifyUser(
                learner.getId(),
                "NEW_REVIEW",
                "You received a learner review",
                mentor.getFullName() + " rated your learning session " + rating + "/5",
                saved.getId());

        return saved;
    }

    // ════════════════════════════════════════════════
    //  Review Reply
    // ════════════════════════════════════════════════

    /**
     * Reply to a mentor review. Only the mentor who owns the review can reply.
     */
    @Transactional
    @CacheEvict(value = {"mentorReviews", "mentorRating"}, key = "#mentor.id")
    public MentorReview replyToReview(User mentor, Long reviewId, String replyText) {
        MentorReview review = mentorReviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        if (!review.getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("You can only reply to your own reviews");
        }

        review.setReplyText(trimToNull(replyText));
        return mentorReviewRepository.save(review);
    }

    // ════════════════════════════════════════════════
    //  Eligibility Checks
    // ════════════════════════════════════════════════

    /**
     * Get bookings eligible for mentor review (learner's completed sessions with a mentor).
     */
    public List<EligibleBookingResponse> getEligibleBookingsForMentorReview(User learner, Long mentorId) {
        Set<PaymentStatus> successStatuses = Set.of(
                PaymentStatus.ESCROWED,
                PaymentStatus.RELEASED,
                PaymentStatus.COMPLETED);

        return bookingRepository
                .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                        learner.getId(), mentorId, BookingStatus.COMPLETED)
                .stream()
                .filter(booking -> !mentorReviewRepository.existsByBookingId(booking.getId()))
                .filter(booking -> booking.getPaymentStatus() != null
                        && successStatuses.contains(booking.getPaymentStatus()))
                .map(EligibleBookingResponse::from)
                .toList();
    }

    /**
     * Get bookings eligible for learner review (mentor's completed sessions with a learner).
     */
    public List<EligibleBookingResponse> getEligibleBookingsForLearnerReview(User mentor, Long learnerId) {
        return bookingRepository
                .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                        mentor.getId(), learnerId, BookingStatus.COMPLETED)
                .stream()
                .filter(booking -> !learnerReviewRepository.existsByBookingId(booking.getId()))
                .map(EligibleBookingResponse::from)
                .toList();
    }

    // ════════════════════════════════════════════════
    //  Review Listing & Statistics
    // ════════════════════════════════════════════════

    /**
     * Get mentor reviews with summary statistics.
     */
    @Cacheable(value = "mentorReviews", key = "T(java.lang.String).format('%d:%d:%d', #mentorId, #page, #size)")
    public ReviewSummaryResponse getMentorReviews(Long mentorId, int page, int size) {
        log.debug("CACHE MISS: fetching mentor reviews from database (mentorId={}, page={})", mentorId, page);
        Pageable pageable = PageRequest.of(page, Math.min(size, 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        List<MentorReview> allReviews = mentorReviewRepository
                .findByMentorIdOrderByCreatedAtDesc(mentorId);
        Page<MentorReview> pageResult = mentorReviewRepository
                .findByMentorIdOrderByCreatedAtDesc(mentorId, pageable);

        List<ReviewItemResponse> reviewItems = pageResult.getContent().stream()
                .map(ReviewItemResponse::from)
                .toList();

        double averageRating = mentorReviewRepository.averageRatingByMentorId(mentorId).orElse(0.0);
        long totalReviews = mentorReviewRepository.countByMentorId(mentorId);
        long recommended = allReviews.stream().filter(r -> r.getRating() >= 4).count();
        long fiveStarReviews = allReviews.stream().filter(r -> r.getRating() == 5).count();

        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            final int currentStar = star;
            long count = allReviews.stream().filter(r -> r.getRating() == currentStar).count();
            distribution.put(star, count);
        }

        int recommendationRate = totalReviews == 0 ? 0
                : (int) Math.round(recommended * 100.0 / totalReviews);

        return new ReviewSummaryResponse(
                Math.round(averageRating * 10.0) / 10.0,
                totalReviews,
                recommendationRate,
                fiveStarReviews,
                distribution,
                reviewItems,
                pageResult.getTotalPages(),
                pageResult.getNumber());
    }

    /**
     * Get learner reviews with summary statistics.
     */
    public ReviewSummaryResponse getLearnerReviews(Long learnerId) {
        List<ReviewItemResponse> reviews = learnerReviewRepository
                .findByLearnerIdOrderByCreatedAtDesc(learnerId)
                .stream()
                .map(review -> new ReviewItemResponse(
                        review.getId(),
                        review.getMentor().getId(),
                        review.getLearner().getId(),
                        review.getMentor().getFullName(),
                        review.getMentor().getDisplayUsername(),
                        review.getMentor().getProfileImageUrl(),
                        review.getRating(),
                        review.getComment(),
                        null,
                        review.getBooking() != null && review.getBooking().getSession() != null
                                ? review.getBooking().getSession().getTitle()
                                : null,
                        review.getCreatedAt() == null ? null : review.getCreatedAt().toString()))
                .toList();

        double averageRating = learnerReviewRepository.averageRatingByLearnerId(learnerId);
        long totalReviews = learnerReviewRepository.countByLearnerId(learnerId);

        return new ReviewSummaryResponse(
                Math.round(averageRating * 10.0) / 10.0,
                totalReviews,
                totalReviews == 0 ? 0 : 100,
                totalReviews,
                Map.of(),
                reviews,
                reviews.isEmpty() ? 0 : 1,
                0);
    }

    // ── helpers ───────────────────────────────────

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
