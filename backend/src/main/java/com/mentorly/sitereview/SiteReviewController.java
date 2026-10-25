package com.mentorly.sitereview;

import com.mentorly.common.ApiResponse;
import com.mentorly.sitereview.SiteReviewDtos.CreateSiteReviewRequest;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticated endpoints for the signed-in user's own platform review.
 * Every other /api/v1/** route already requires authentication (SecurityConfig).
 */
@RestController
@RequestMapping("/api/v1/site-reviews")
@RequiredArgsConstructor
public class SiteReviewController {

    private final SiteReviewService siteReviewService;

    @GetMapping("/me")
    public ApiResponse<SiteReviewResponse> getMine(@AuthenticationPrincipal User user) {
        return new ApiResponse<>("Review fetched", siteReviewService.getCurrentReview(user));
    }

    @PostMapping
    public ApiResponse<SiteReviewResponse> create(
            @AuthenticationPrincipal User user, @RequestBody CreateSiteReviewRequest request) {
        return new ApiResponse<>("Review submitted for approval", siteReviewService.create(user, request));
    }

    @PutMapping("/me")
    public ApiResponse<SiteReviewResponse> updateMine(
            @AuthenticationPrincipal User user, @RequestBody CreateSiteReviewRequest request) {
        return new ApiResponse<>("Review updated and resubmitted for approval",
                siteReviewService.update(user, request));
    }

    @DeleteMapping("/me")
    public ApiResponse<Boolean> deleteMine(@AuthenticationPrincipal User user) {
        siteReviewService.delete(user);
        return new ApiResponse<>("Review deleted", true);
    }
}
