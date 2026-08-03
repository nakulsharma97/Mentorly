package com.skillswap.sessionrequest;

import com.skillswap.common.ApiResponse;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * REST controller exposing session request endpoints.
 */
@RestController
@RequestMapping("/api/v1/session-requests")
@RequiredArgsConstructor
public class SessionRequestController {

    private final SessionRequestService sessionRequestService;

    /**
     * Learner sends a session request to a mentor.
     */
    @PostMapping
    public ApiResponse<SessionRequest> create(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody CreateRequest req) {
        SessionRequest created = sessionRequestService.createRequest(
                currentUser, req.mentorId(), req.message(),
                req.subject(), req.preferredDate(), req.preferredTime(),
                req.preferredDuration(), req.budget());
        return new ApiResponse<>("Session request sent", created);
    }

    /**
     * Get pending requests (for mentors) or own requests (for learners).
     */
    @Transactional(readOnly = true)
    @GetMapping
    public ApiResponse<List<SessionRequest>> list(@AuthenticationPrincipal User currentUser) {
        if (currentUser.getRole() == UserRole.MENTOR) {
            return new ApiResponse<>("Pending requests fetched",
                    sessionRequestService.listPendingForMentor(currentUser));
        }
        return new ApiResponse<>("Your requests fetched",
                sessionRequestService.listForLearner(currentUser));
    }

    /**
     * Mentor accepts a session request (with optional custom message).
     */
    @PostMapping("/{id}/accept")
    public ApiResponse<SessionRequest> accept(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) AcceptRequest body) {
        String message = (body != null) ? body.message() : null;
        SessionRequest accepted = sessionRequestService.acceptRequest(currentUser, id, message);
        return new ApiResponse<>("Session request accepted", accepted);
    }

    /**
     * Learner replies to a mentor's acceptance/decline message.
     */
    @PostMapping("/{id}/reply")
    public ApiResponse<SessionRequest> reply(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ReplyRequest req) {
        SessionRequest replied = sessionRequestService.replyToRequest(currentUser, id, req.message());
        return new ApiResponse<>("Reply sent to mentor", replied);
    }

    /**
     * Learner cancels their own pending session request.
     */
    @PostMapping("/{id}/cancel")
    public ApiResponse<SessionRequest> cancel(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        SessionRequest cancelled = sessionRequestService.cancelRequest(currentUser, id);
        return new ApiResponse<>("Session request cancelled", cancelled);
    }

    /**
     * Mentor declines a session request (with optional reason).
     */
    @PostMapping("/{id}/decline")
    public ApiResponse<SessionRequest> decline(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestParam(required = false) String reason) {
        SessionRequest declined = sessionRequestService.declineRequest(currentUser, id, reason);
        return new ApiResponse<>("Session request declined", declined);
    }

    /**
     * Mentor creates a session from an accepted request (sets time, title, price, etc.)
     */
    @PostMapping("/{id}/create-session")
    public ApiResponse<SkillSession> createSessionFromRequest(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody CreateSessionFromRequest req) {
        SkillSession session = sessionRequestService.createSessionFromRequest(
                currentUser, id,
                req.title(),
                req.description(),
                req.startTime(),
                req.endTime(),
                req.priceAmount(),
                req.meetingLink());
        return new ApiResponse<>("Session created from request", session);
    }

/**
 * Immutable data carrier for create request.
 */
    public record CreateRequest(
            @NotNull Long mentorId,
            String message,
            String subject,
            String preferredDate,
            String preferredTime,
            Integer preferredDuration,
            String budget) {
    }

/**
 * Immutable data carrier for accept request.
 */
    public record AcceptRequest(String message) {
    }

/**
 * Immutable data carrier for reply request.
 */
    public record ReplyRequest(@NotBlank String message) {
    }

/**
 * Immutable data carrier for create session from request.
 */
    public record CreateSessionFromRequest(
            @NotBlank String title,
            String description,
            @NotNull @Future OffsetDateTime startTime,
            @NotNull @Future OffsetDateTime endTime,
            @DecimalMin("0") BigDecimal priceAmount,
            String meetingLink) {
    }
}
