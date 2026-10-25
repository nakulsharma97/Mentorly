package com.mentorly.sitereview;

import com.mentorly.common.ApiResponse;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewAdminRequest;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewAdminResponse;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Moderation endpoints for site reviews. Secured by SecurityConfig:
 * /api/v1/admin/** accepts only ROLE_ADMIN (403 otherwise, 401 anonymous).
 */
@RestController
@RequestMapping("/api/v1/admin/site-reviews")
@RequiredArgsConstructor
public class SiteReviewAdminController {

    private final SiteReviewService siteReviewService;

    @GetMapping
    public ApiResponse<Page<SiteReviewAdminResponse>> list(
            @RequestParam(name = "status", required = false) SiteReviewStatus status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return new ApiResponse<>("Site reviews fetched", siteReviewService.adminList(status, page, size));
    }

    @PatchMapping("/{id}/approve")
    public ApiResponse<SiteReviewResponse> approve(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @RequestBody(required = false) SiteReviewAdminRequest body) {
        return new ApiResponse<>("Site review approved",
                siteReviewService.adminApprove(admin, id, body == null ? null : body.adminNote()));
    }

    @PatchMapping("/{id}/reject")
    public ApiResponse<SiteReviewResponse> reject(
            @AuthenticationPrincipal User admin,
            @PathVariable Long id,
            @RequestBody(required = false) SiteReviewAdminRequest body) {
        return new ApiResponse<>("Site review rejected",
                siteReviewService.adminReject(admin, id, body == null ? null : body.adminNote()));
    }
}
