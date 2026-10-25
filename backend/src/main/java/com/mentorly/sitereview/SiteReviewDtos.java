package com.mentorly.sitereview;

import java.time.OffsetDateTime;

/** Request/response payloads for the site-review endpoints. */
public final class SiteReviewDtos {

    private SiteReviewDtos() {
    }

    /** Body for POST /site-reviews and PUT /site-reviews/me. */
    public record CreateSiteReviewRequest(Integer rating, String title, String comment) {
    }

    /** The current user's own review (adminNote included so rejections are explainable). */
    public record SiteReviewResponse(
            Long id,
            Integer rating,
            String title,
            String comment,
            SiteReviewStatus status,
            String adminNote,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {

        public static SiteReviewResponse from(SiteReview review) {
            if (review == null) {
                return null;
            }
            return new SiteReviewResponse(
                    review.getId(),
                    review.getRating(),
                    review.getTitle(),
                    review.getComment(),
                    review.getStatus(),
                    review.getAdminNote(),
                    review.getCreatedAt(),
                    review.getUpdatedAt());
        }
    }

    /** Admin list row — reviewer identity only, never the email address. */
    public record SiteReviewAdminResponse(
            Long id,
            String reviewerName,
            String reviewerRole,
            Integer rating,
            String title,
            String comment,
            SiteReviewStatus status,
            String adminNote,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {

        public static SiteReviewAdminResponse from(SiteReview review) {
            return new SiteReviewAdminResponse(
                    review.getId(),
                    review.getUser() != null ? review.getUser().getFullName() : null,
                    review.getUser() != null && review.getUser().getRole() != null
                            ? review.getUser().getRole().name()
                            : null,
                    review.getRating(),
                    review.getTitle(),
                    review.getComment(),
                    review.getStatus(),
                    review.getAdminNote(),
                    review.getCreatedAt(),
                    review.getUpdatedAt());
        }
    }

    /** Body for PATCH /admin/site-reviews/{id}/approve|reject — the note is optional. */
    public record SiteReviewAdminRequest(String adminNote) {
    }
}
