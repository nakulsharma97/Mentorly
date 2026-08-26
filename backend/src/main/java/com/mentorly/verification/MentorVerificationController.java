package com.mentorly.verification;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import com.mentorly.verification.MentorVerificationDtos.MentorVerificationStatusDto;
import com.mentorly.verification.MentorVerificationDtos.SubmitMentorVerificationRequest;
import com.mentorly.verification.MentorVerificationDtos.UpdateMentorVerificationStatusRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing mentor verification endpoints.
 *
 * <p><b>Mentor-facing:</b> {@code POST /request} lets any learner (or mentor)
 * apply to become a verified mentor — the role guard was removed so fresh
 * users can submit an application. {@code GET /my} and {@code GET /status}
 * let applicants track their application.
 *
 * <p><b>Admin-facing:</b> {@code GET /requests}, {@code GET /requests/{id}}
 * and {@code PATCH /requests/{id}} power the admin verification queue.
 * Approving promotes the user's role to {@code MENTOR}, enables the mentor
 * dashboard, notifies the user, and writes an audit trail.
 *
 * <p>All business logic lives in {@link MentorVerificationService}.
 */
@RestController
@RequestMapping("/api/v1/verification/mentor")
@RequiredArgsConstructor
public class MentorVerificationController {

    private final MentorVerificationService service;

    @PostMapping("/request")
    public ApiResponse<MentorVerificationDto> submit(
            @AuthenticationPrincipal User currentUser,
            @RequestBody SubmitMentorVerificationRequest req) {
        return new ApiResponse<>("Verification request submitted",
                service.submit(currentUser, req));
    }

    @GetMapping("/my")
    public ApiResponse<List<MentorVerificationDto>> myRequests(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Mentor verification requests fetched",
                service.myRequests(currentUser));
    }

    /**
     * Latest verification state for the signed-in user — feeds the mentor
     * dashboard verification banner.
     */
    @GetMapping("/status")
    public ApiResponse<MentorVerificationStatusDto> status(@AuthenticationPrincipal User currentUser) {
        MentorVerificationRequest latest = service.latestFor(currentUser);
        return new ApiResponse<>("Mentor verification status fetched",
                MentorVerificationStatusDto.from(latest, currentUser));
    }

    @GetMapping("/requests")
    public ApiResponse<List<MentorVerificationDto>> moderationQueue(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") MentorVerificationRequestStatus status) {
        return new ApiResponse<>("Mentor verification moderation queue fetched",
                service.moderationQueue(currentUser, status));
    }

    @GetMapping("/requests/{id}")
    public ApiResponse<MentorVerificationDto> requestDetail(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        return new ApiResponse<>("Mentor verification request fetched",
                service.requestDetail(currentUser, id));
    }

    @PatchMapping("/requests/{id}")
    public ApiResponse<MentorVerificationDto> updateStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateMentorVerificationStatusRequest req) {
        return new ApiResponse<>("Mentor verification request updated",
                service.updateStatus(currentUser, id, req));
    }

}
