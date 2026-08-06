package com.skillswap.review;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.notification.NotificationService;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * REST controller exposing review endpoints.
 */
@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ProfileCompletionGuard profileCompletionGuard;

    @GetMapping({ "/mentor", "/mentor/{mentorId}" })
    public ApiResponse<ReviewSummaryResponse> listMentorReviews(
            @AuthenticationPrincipal User mentor,
            @PathVariable(required = false) Long mentorId) {
        long resolvedMentorId = mentorId != null ? mentorId : mentor.getId();
        List<MentorReview> reviews = mentorReviewRepository.findByMentorIdOrderByCreatedAtDesc(resolvedMentorId);
        List<ReviewItemResponse> reviewItems = reviews.stream()
                .map(ReviewItemResponse::from)
                .toList();

        double averageRating = mentorReviewRepository.averageRatingByMentorId(resolvedMentorId).orElse(0.0);
        long totalReviews = mentorReviewRepository.countByMentorId(resolvedMentorId);
        long recommended = reviews.stream().filter(review -> review.getRating() >= 4).count();
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            final int currentStar = star;
            long count = reviews.stream().filter(review -> review.getRating() == currentStar).count();
            distribution.put(star, count);
        }

        int recommendationRate = totalReviews == 0 ? 0
                : (int) Math.round(recommended * 100.0 / totalReviews);
        return new ApiResponse<>("Mentor reviews fetched",
                new ReviewSummaryResponse(
                        Math.round(averageRating * 10.0) / 10.0,
                        totalReviews,
                        recommendationRate,
                        reviews.stream().filter(review -> review.getRating() == 5).count(),
                        distribution,
                        reviewItems));
    }

    @PostMapping("/{reviewId}/reply")
    public ApiResponse<ReviewItemResponse> replyToReview(
            @AuthenticationPrincipal User mentor,
            @PathVariable Long reviewId,
            @RequestBody ReplyReviewRequest request) {
        MentorReview review = mentorReviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));

        if (!review.getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("You can only reply to your own reviews");
        }

        review.setReplyText(trimToNull(request.replyText()));
        MentorReview saved = mentorReviewRepository.save(review);
        return new ApiResponse<>("Reply saved", ReviewItemResponse.from(saved));
    }

    @GetMapping("/eligible/mentor/{mentorId}")
    public ApiResponse<List<EligibleBookingResponse>> eligibleBookingsForReview(
            @AuthenticationPrincipal User learner,
            @PathVariable Long mentorId) {
        Set<PaymentStatus> successStatuses = Set.of(
                PaymentStatus.ESCROWED,
                PaymentStatus.RELEASED,
                PaymentStatus.COMPLETED);
        List<EligibleBookingResponse> eligible = bookingRepository
                .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                        learner.getId(),
                        mentorId,
                        BookingStatus.COMPLETED)
                .stream()
                .filter(booking -> !mentorReviewRepository.existsByBookingId(booking.getId()))
                .filter(booking -> booking.getPaymentStatus() != null
                        && successStatuses.contains(booking.getPaymentStatus()))
                .map(EligibleBookingResponse::from)
                .toList();

        return new ApiResponse<>("Eligible bookings fetched", eligible);
    }

    @GetMapping("/learner/{learnerId}")
    public ApiResponse<ReviewSummaryResponse> listLearnerReviews(@PathVariable Long learnerId) {
        List<ReviewItemResponse> reviews = learnerReviewRepository.findByLearnerIdOrderByCreatedAtDesc(learnerId)
                .stream()
                .map(review -> new ReviewItemResponse(
                        review.getId(),
                        review.getMentor().getId(),
                        review.getLearner().getId(),
                        review.getMentor().getFullName(),
                        review.getMentor().getDisplayUsername(),
                        review.getRating(),
                        review.getComment(),
                        null,
                        review.getCreatedAt() == null ? null : review.getCreatedAt().toString()))
                .toList();

        double averageRating = learnerReviewRepository.averageRatingByLearnerId(learnerId);
        long totalReviews = learnerReviewRepository.countByLearnerId(learnerId);

        return new ApiResponse<>("Learner reviews fetched",
                new ReviewSummaryResponse(
                        Math.round(averageRating * 10.0) / 10.0,
                        totalReviews,
                        totalReviews == 0 ? 0 : 100,
                        totalReviews,
                        Map.of(),
                        reviews));
    }

    @GetMapping("/eligible/learner/{learnerId}")
    public ApiResponse<List<EligibleBookingResponse>> eligibleBookingsForLearnerReview(
            @AuthenticationPrincipal User mentor,
            @PathVariable Long learnerId) {
        List<EligibleBookingResponse> eligible = bookingRepository
                .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                        mentor.getId(),
                        learnerId,
                        BookingStatus.COMPLETED)
                .stream()
                .filter(booking -> !learnerReviewRepository.existsByBookingId(booking.getId()))
                .map(EligibleBookingResponse::from)
                .toList();

        return new ApiResponse<>("Eligible learner bookings fetched", eligible);
    }

    @PostMapping
    public ApiResponse<ReviewItemResponse> createReview(
            @AuthenticationPrincipal User learner,
            @RequestBody CreateReviewRequest request) {
        profileCompletionGuard.requireProfileCompleted(learner,
                "Please complete your profile before writing reviews.");
        if (request.rating() == null || request.rating() < 1 || request.rating() > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }

        Booking booking = bookingRepository.findById(request.bookingId())
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

        User mentor = userRepository.findById(request.mentorId())
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));

        if (!booking.getSession().getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("Booking does not belong to this mentor");
        }

        MentorReview review = new MentorReview();
        review.setBooking(booking);
        review.setMentor(mentor);
        review.setLearner(learner);
        review.setRating(request.rating());
        review.setComment(trimToNull(request.comment()));

        MentorReview saved = mentorReviewRepository.save(review);
        notificationService.notifyUser(
                mentor.getId(),
                "NEW_REVIEW",
                "You received a new mentor review",
                learner.getFullName() + " rated your session " + request.rating() + "/5",
                saved.getId());
        return new ApiResponse<>("Review submitted", ReviewItemResponse.from(saved));
    }

    @PostMapping("/learner")
    public ApiResponse<LearnerReview> submitLearnerReview(
            @AuthenticationPrincipal User mentor,
            @RequestBody CreateReviewRequest req) {
        profileCompletionGuard.requireProfileCompleted(mentor,
                "Please complete your profile before writing reviews.");
        Booking booking = bookingRepository.findById(req.bookingId())
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        User learner = userRepository.findById(req.mentorId())
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

        int rating = req.rating();
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }

        LearnerReview review = new LearnerReview();
        review.setBooking(booking);
        review.setMentor(mentor);
        review.setLearner(learner);
        review.setRating(rating);
        review.setComment(req.comment() == null ? null : req.comment().trim());
        LearnerReview saved = learnerReviewRepository.save(review);
        notificationService.notifyUser(
                learner.getId(),
                "NEW_REVIEW",
                "You received a learner review",
                mentor.getFullName() + " rated your learning session " + rating + "/5",
                saved.getId());

        return new ApiResponse<>("Learner review submitted", saved);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

/**
 * Immutable data carrier for create review request.
 */
    public record CreateReviewRequest(Long bookingId, Long mentorId, Integer rating, String comment) {
    }

/**
 * Immutable data carrier for eligible booking response.
 */
    public record EligibleBookingResponse(Long bookingId, Long sessionId, String sessionTitle, String completedAt) {
        static EligibleBookingResponse from(Booking booking) {
            return new EligibleBookingResponse(
                    booking.getId(),
                    booking.getSession().getId(),
                    booking.getSession().getTitle(),
                    booking.getCreatedAt() == null ? null : booking.getCreatedAt().toString());
        }
    }

/**
 * Immutable data carrier for review item response.
 */
    public record ReviewItemResponse(
            Long id,
            Long mentorId,
            Long learnerId,
            String learnerName,
            String learnerUsername,
            Integer rating,
            String comment,
            String replyText,
            String createdAt) {
        static ReviewItemResponse from(MentorReview review) {
            return new ReviewItemResponse(
                    review.getId(),
                    review.getMentor().getId(),
                    review.getLearner().getId(),
                    review.getLearner().getFullName(),
                    review.getLearner().getDisplayUsername(),
                    review.getRating(),
                    review.getComment(),
                    review.getReplyText(),
                    review.getCreatedAt() == null ? null : review.getCreatedAt().toString());
        }
    }

/**
 * Immutable data carrier for review summary response.
 */
    public record ReviewSummaryResponse(
            Double averageRating,
            Long totalReviews,
            Integer recommendationRate,
            Long fiveStarReviews,
            Map<Integer, Long> distribution,
            List<ReviewItemResponse> reviews) {
    }

/**
 * Immutable data carrier for reply review request.
 */
    public record ReplyReviewRequest(String replyText) {
    }
}
