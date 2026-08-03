package com.skillswap.session;

import com.skillswap.common.ApiResponse;
import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.meeting.provider.MeetingProviderException;
import com.skillswap.session.dto.CreateLiveSessionRequest;
import com.skillswap.session.dto.LiveSessionResponse;
import com.skillswap.session.dto.SecureJoinSessionResponse;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing live session endpoints.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LiveSessionController {

    private final LiveSessionService liveSessionService;

    @PostMapping("/admin/live-sessions")
    public ApiResponse<LiveSessionResponse> createLiveSession(
            @AuthenticationPrincipal User currentUser,
            @RequestBody CreateLiveSessionRequest request) throws MeetingProviderException {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() != UserRole.MENTOR && currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only mentors and admins can create live sessions");
        }

        return new ApiResponse<>("Live session created", liveSessionService.createLiveSession(request, currentUser));
    }

    @GetMapping("/admin/live-sessions")
    public ApiResponse<List<LiveSessionResponse>> listLiveSessions(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() == UserRole.ADMIN) {
            return new ApiResponse<>("Live sessions fetched",
                    liveSessionService.getUpcomingSessions(currentUser.getId()));
        }
        if (currentUser.getRole() == UserRole.MENTOR) {
            return new ApiResponse<>("Live sessions fetched",
                    liveSessionService.getUpcomingSessions(currentUser.getId()));
        }
        throw new UnauthorizedException("Only mentors and admins can view live sessions");
    }

    @GetMapping("/admin/live-sessions/{sessionId}")
    public ApiResponse<LiveSessionResponse> getLiveSession(@PathVariable Long sessionId) {
        return new ApiResponse<>("Live session fetched", liveSessionService.getSession(sessionId));
    }

    @PutMapping("/admin/live-sessions/{sessionId}")
    public ApiResponse<LiveSessionResponse> updateLiveSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long sessionId,
            @RequestBody CreateLiveSessionRequest request) throws MeetingProviderException {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return new ApiResponse<>("Live session updated",
                liveSessionService.updateLiveSession(sessionId, request, currentUser));
    }

    @DeleteMapping("/admin/live-sessions/{sessionId}")
    public ApiResponse<String> cancelLiveSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long sessionId) throws MeetingProviderException {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        liveSessionService.cancelLiveSession(sessionId, currentUser);
        return new ApiResponse<>("Live session cancelled", "cancelled");
    }

    @GetMapping("/live-sessions/{sessionId}")
    public ApiResponse<LiveSessionResponse> getPublicLiveSession(@PathVariable Long sessionId) {
        return new ApiResponse<>("Live session fetched", liveSessionService.getSession(sessionId));
    }

    @GetMapping("/live-sessions/{sessionId}/join")
    public ApiResponse<SecureJoinSessionResponse> joinLiveSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long sessionId) {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() != UserRole.LEARNER && currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only learners can join a live session");
        }

        return new ApiResponse<>("Join status fetched",
                liveSessionService.getSecureJoinLink(sessionId, currentUser.getId()));
    }
}
