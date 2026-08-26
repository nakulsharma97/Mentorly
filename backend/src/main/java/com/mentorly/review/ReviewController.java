package com.mentorly.review;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.mentorly.review.ReviewDtos.CreateReviewRequest;
import com.mentorly.review.ReviewDtos.EligibleBookingResponse;
import com.mentorly.review.ReviewDtos.ReviewItemResponse;
import com.mentorly.review.ReviewDtos.ReviewSummaryResponse;
import com.mentorly.review.ReviewDtos.ReplyReviewRequest;

/**
 * REST controller exposing review endpoints.
 * Delegates all business logic to {@link ReviewService}.
 */
@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping({ "/mentor", "/mentor/{mentorId}" })
    public ApiResponse<ReviewSummaryResponse> listMentorReviews(
            @AuthenticationPrincipal User mentor,
            @PathVariable(required = false) Long mentorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        long resolvedMentorId = mentorId != null ? mentorId : mentor.getId();
        return new ApiResponse<>("Mentor reviews fetched",
                reviewService.getMentorReviews(resolvedMentorId, page, size));
    }

    @PostMapping("/{reviewId}/reply")
    public ApiResponse<ReviewItemResponse> replyToReview(
            @AuthenticationPrincipal User mentor,
            @PathVariable Long reviewId,
            @RequestBody ReplyReviewRequest request) {
        MentorReview saved = reviewService.replyToReview(mentor, reviewId, request.replyText());
        return new ApiResponse<>("Reply saved", ReviewItemResponse.from(saved));
    }

    @GetMapping("/eligible/mentor/{mentorId}")
    public ApiResponse<List<EligibleBookingResponse>> eligibleBookingsForReview(
            @AuthenticationPrincipal User learner,
            @PathVariable Long mentorId) {
        return new ApiResponse<>("Eligible bookings fetched",
                reviewService.getEligibleBookingsForMentorReview(learner, mentorId));
    }

    @GetMapping("/learner/{learnerId}")
    public ApiResponse<ReviewSummaryResponse> listLearnerReviews(@PathVariable Long learnerId) {
        return new ApiResponse<>("Learner reviews fetched",
                reviewService.getLearnerReviews(learnerId));
    }

    @GetMapping("/eligible/learner/{learnerId}")
    public ApiResponse<List<EligibleBookingResponse>> eligibleBookingsForLearnerReview(
            @AuthenticationPrincipal User mentor,
            @PathVariable Long learnerId) {
        return new ApiResponse<>("Eligible learner bookings fetched",
                reviewService.getEligibleBookingsForLearnerReview(mentor, learnerId));
    }

    @PostMapping
    public ApiResponse<ReviewItemResponse> createReview(
            @AuthenticationPrincipal User learner,
            @RequestBody CreateReviewRequest request) {
        MentorReview saved = reviewService.createMentorReview(
                learner, request.bookingId(), request.mentorId(),
                request.rating(), request.comment());
        return new ApiResponse<>("Review submitted", ReviewItemResponse.from(saved));
    }

    @PostMapping("/learner")
    public ApiResponse<LearnerReview> submitLearnerReview(
            @AuthenticationPrincipal User mentor,
            @RequestBody CreateReviewRequest req) {
        // NOTE: req.mentorId() is used for learnerId in this endpoint — this is
        // the existing API contract and is preserved as-is.
        LearnerReview saved = reviewService.createLearnerReview(
                mentor, req.bookingId(), req.mentorId(),
                req.rating(), req.comment());
        return new ApiResponse<>("Learner review submitted", saved);
    }
}
