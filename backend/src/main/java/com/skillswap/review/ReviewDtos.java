package com.skillswap.review;

import com.skillswap.booking.Booking;

import java.util.List;
import java.util.Map;

/**
 * DTOs for review endpoints. Extracted from ReviewController inner records
 * so both ReviewController and ReviewService can reference them.
 */
public final class ReviewDtos {

    private ReviewDtos() {}

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
            String learnerUsername,
            String learnerProfileImageUrl,
            Integer rating,
            String comment,
            String replyText,
            String skillName,
            String createdAt) {
        static ReviewItemResponse from(MentorReview review) {
            String skillName = review.getBooking() != null
                    && review.getBooking().getSession() != null
                    && review.getBooking().getSession().getTitle() != null
                            ? review.getBooking().getSession().getTitle()
                            : null;
            return new ReviewItemResponse(
                    review.getId(),
                    review.getMentor().getId(),
                    review.getLearner().getId(),
                    review.getLearner().getFullName(),
                    review.getLearner().getDisplayUsername(),
                    review.getLearner().getProfileImageUrl(),
                    review.getRating(),
                    review.getComment(),
                    review.getReplyText(),
                    skillName,
                    review.getCreatedAt() == null ? null : review.getCreatedAt().toString());
        }
    }

    public record ReviewSummaryResponse(
            Double averageRating,
            Long totalReviews,
            Integer recommendationRate,
            Long fiveStarReviews,
            Map<Integer, Long> distribution,
            List<ReviewItemResponse> reviews,
            int totalPages,
            int currentPage) {
    }

    public record ReplyReviewRequest(String replyText) {
    }
}
