package com.mentorly.stats;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Encapsulates review.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ReviewDto {
    private Long reviewId;
    private String reviewerName;
    private String reviewerProfileImageUrl;
    private boolean reviewerVerified;
    private String reviewerRole;
    private String skillExchanged;
    private long completedSwaps;
    private int rating;
    private OffsetDateTime reviewDate;
    private String reviewText;

    /**
     * Which table this row came from: "SITE", "MENTOR_REVIEW" or
     * "LEARNER_REVIEW". The three sources have independent id sequences, so
     * clients must key on source + reviewId to keep React keys unique.
     */
    private String source;
}
