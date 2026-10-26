package com.mentorly.review;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.common.ApiClientException;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.notification.NotificationService;
import com.mentorly.payment.PaymentStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
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
    @CacheEvict(value = "mentorReviews", allEntries = true)
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
     *
     * <p>No {@code @CacheEvict} here on purpose: learner reviews are served by
     * the uncached {@link #getLearnerReviews(Long)}, so there is nothing to
     * invalidate. (The old annotation referenced a {@code #mentorId} parameter
     * this method never had, which made every call fail with "Null key returned
     * for cache operation".)
     */
    @Transactional
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
    @CacheEvict(value = "mentorReviews", allEntries = true)
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
    //  Read access rules
    // ════════════════════════════════════════════════

    /**
     * Resolves the mentor id whose reviews the caller may read.
     *
     * <p>Any signed-in learner or mentor may read an APPROVED mentor's reviews
     * (that is the profile data shown to logged-in learners). Reviews of a
     * mentor who is not approved are visible only to that mentor and to admins
     * — everyone else gets the same 404 a missing profile would give, so
     * unapproved mentors cannot be probed for.
     *
     * @param caller   the authenticated user
     * @param mentorId requested mentor id, or null to read the caller's own
     * @return the mentor id whose reviews may be loaded
     */
    public long resolveMentorReviewsTarget(User caller, Long mentorId) {
        if (caller == null) {
            throw new ApiClientException(
                    HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "Authentication required", false);
        }
        Long callerId = caller.getId();
        long target = mentorId != null ? mentorId : (callerId != null ? callerId : -1L);
        if ((callerId != null && callerId == target) || caller.getRole() == UserRole.ADMIN) {
            return target;
        }
        userRepository.findById(target)
                .filter(User::isApprovedMentor)
                .orElseThrow(() -> new ApiClientException(
                        HttpStatus.NOT_FOUND, "MENTOR_NOT_FOUND", "Mentor not found", false));
        return target;
    }

    /**
     * Learner reviews are private: only the learner themself, a mentor who
     * actually wrote one of the reviews about that learner, or an admin may
     * read them. Everyone else gets 403.
     */
    public void assertLearnerReviewsVisible(User caller, Long learnerId) {
        if (caller == null) {
            throw new ApiClientException(
                    HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "Authentication required", false);
        }
        if (learnerId == null || caller.getId().equals(learnerId)
                || caller.getRole() == UserRole.ADMIN) {
            return;
        }
        if (learnerReviewRepository.existsByLearnerIdAndMentorId(learnerId, caller.getId())) {
            return;
        }
        throw new ApiClientException(
                HttpStatus.FORBIDDEN,
                "LEARNER_REVIEWS_FORBIDDEN",
                "You do not have permission to view these reviews",
                false);
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

        List<Booking> completed = bookingRepository
                .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                        learner.getId(), mentorId, BookingStatus.COMPLETED);
        // ONE query for every already-reviewed booking — not one per row.
        Set<Long> reviewed = alreadyReviewedBookingIds(completed, mentorReviewRepository::findReviewedBookingIdsIn);

        return completed.stream()
                .filter(booking -> !reviewed.contains(booking.getId()))
                .filter(booking -> booking.getPaymentStatus() != null
                        && successStatuses.contains(booking.getPaymentStatus()))
                .map(EligibleBookingResponse::from)
                .toList();
    }

    /**
     * Get bookings eligible for learner review (mentor's completed sessions with a learner).
     */
    public List<EligibleBookingResponse> getEligibleBookingsForLearnerReview(User mentor, Long learnerId) {
        List<Booking> completed = bookingRepository
                .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                        mentor.getId(), learnerId, BookingStatus.COMPLETED);
        // ONE query for every already-reviewed booking — not one per row.
        Set<Long> reviewed = alreadyReviewedBookingIds(completed, learnerReviewRepository::findReviewedBookingIdsIn);

        return completed.stream()
                .filter(booking -> !reviewed.contains(booking.getId()))
                .map(EligibleBookingResponse::from)
                .toList();
    }

    /**
     * Ids of the given bookings that already carry a review, resolved with a
     * single {@code IN (...)} query instead of one {@code existsByBookingId}
     * round-trip per booking (the old N+1 on both eligibility endpoints).
     */
    private Set<Long> alreadyReviewedBookingIds(
            List<Booking> bookings,
            java.util.function.Function<java.util.Collection<Long>, List<Long>> reviewedIdsLookup) {
        if (bookings.isEmpty()) {
            return Set.of();
        }
        List<Long> ids = bookings.stream().map(Booking::getId).toList();
        return new java.util.HashSet<>(reviewedIdsLookup.apply(ids));
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

        Page<MentorReview> pageResult = mentorReviewRepository
                .findByMentorIdOrderByCreatedAtDesc(mentorId, pageable);

        List<ReviewItemResponse> reviewItems = pageResult.getContent().stream()
                .map(ReviewItemResponse::from)
                .toList();

        double averageRating = mentorReviewRepository.averageRatingByMentorId(mentorId).orElse(0.0);
        long totalReviews = mentorReviewRepository.countByMentorId(mentorId);

        // Star distribution from ONE GROUP BY query — the old implementation
        // loaded every review of this mentor (twice) and streamed the full list
        // five more times to build the histogram.
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        long recommended = 0L;
        for (int star = 5; star >= 1; star--) {
            distribution.put(star, 0L);
        }
        for (Object[] row : mentorReviewRepository.countByRatingForMentorId(mentorId)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            int star = ((Number) row[0]).intValue();
            long count = ((Number) row[1]).longValue();
            distribution.put(star, count);
            if (star >= 4) {
                recommended += count;
            }
        }
        long fiveStarReviews = distribution.getOrDefault(5, 0L);

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
        List<LearnerReview> all = learnerReviewRepository.findByLearnerIdOrderByCreatedAtDesc(learnerId);

        List<ReviewItemResponse> reviews = all.stream()
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

        // Derived from the rows we already loaded: the previous version hard
        // coded a 100% recommendation rate for any non-empty list and passed the
        // total into the five-star slot, so both numbers were wrong.
        long totalReviews = all.size();
        long fiveStarReviews = all.stream().filter(r -> Integer.valueOf(5).equals(r.getRating())).count();
        long recommended = all.stream().filter(r -> r.getRating() != null && r.getRating() >= 4).count();
        double averageRating = totalReviews == 0 ? 0.0
                : all.stream().mapToLong(LearnerReview::getRating).average().orElse(0.0);

        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            final int currentStar = star;
            distribution.put(star, all.stream().filter(r -> Integer.valueOf(currentStar).equals(r.getRating())).count());
        }

        return new ReviewSummaryResponse(
                Math.round(averageRating * 10.0) / 10.0,
                totalReviews,
                totalReviews == 0 ? 0 : (int) Math.round(recommended * 100.0 / totalReviews),
                fiveStarReviews,
                distribution,
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
