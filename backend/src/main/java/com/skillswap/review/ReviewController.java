package com.skillswap.review;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.ApiResponse;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final MentorReviewRepository mentorReviewRepository;
    private final LearnerReviewRepository learnerReviewRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @GetMapping("/mentor/{mentorId}")
    public ApiResponse<ReviewSummaryResponse> listMentorReviews(@PathVariable Long mentorId) {
        List<ReviewItemResponse> reviews = mentorReviewRepository.findByMentorIdOrderByCreatedAtDesc(mentorId)
                .stream()
                .map(ReviewItemResponse::from)
                .toList();

        double averageRating = mentorReviewRepository.averageRatingByMentorId(mentorId).orElse(0.0);
        long totalReviews = mentorReviewRepository.countByMentorId(mentorId);

        return new ApiResponse<>("Mentor reviews fetched",
                new ReviewSummaryResponse(Math.round(averageRating * 10.0) / 10.0, totalReviews, reviews));
    }

    @GetMapping("/eligible/mentor/{mentorId}")
    public ApiResponse<List<EligibleBookingResponse>> eligibleBookingsForReview(
            @AuthenticationPrincipal User learner,
            @PathVariable Long mentorId) {
        List<EligibleBookingResponse> eligible = bookingRepository
                .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                        learner.getId(),
                        mentorId,
                        BookingStatus.COMPLETED)
                .stream()
                .filter(booking -> !mentorReviewRepository.existsByBookingId(booking.getId()))
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
                        review.getRating(),
                        review.getComment(),
                        review.getCreatedAt() == null ? null : review.getCreatedAt().toString()))
                .toList();

        double averageRating = learnerReviewRepository.averageRatingByLearnerId(learnerId);
        long totalReviews = learnerReviewRepository.countByLearnerId(learnerId);

        return new ApiResponse<>("Learner reviews fetched",
                new ReviewSummaryResponse(Math.round(averageRating * 10.0) / 10.0, totalReviews, reviews));
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

    public record CreateReviewRequest(Long bookingId, Long mentorId, Integer rating, String comment) {
    }

    public record EligibleBookingResponse(Long bookingId, Long sessionId, String sessionTitle, String completedAt) {
        static EligibleBookingResponse from(Booking booking) {
            return new EligibleBookingResponse(
                    booking.getId(),
                    booking.getSession().getId(),
                    booking.getSession().getTitle(),
                    booking.getCreatedAt() == null ? null : booking.getCreatedAt().toString());
        }
    }

    public record ReviewItemResponse(
            Long id,
            Long mentorId,
            Long learnerId,
            String learnerName,
            Integer rating,
            String comment,
            String createdAt) {
        static ReviewItemResponse from(MentorReview review) {
            return new ReviewItemResponse(
                    review.getId(),
                    review.getMentor().getId(),
                    review.getLearner().getId(),
                    review.getLearner().getFullName(),
                    review.getRating(),
                    review.getComment(),
                    review.getCreatedAt() == null ? null : review.getCreatedAt().toString());
        }
    }

    public record ReviewSummaryResponse(Double averageRating, Long totalReviews, List<ReviewItemResponse> reviews) {
    }
}
