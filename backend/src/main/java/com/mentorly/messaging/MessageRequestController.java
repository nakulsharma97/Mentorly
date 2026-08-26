package com.mentorly.messaging;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing message request endpoints.
 */
@RestController
@RequestMapping("/api/message-requests")
@RequiredArgsConstructor
public class MessageRequestController {

    private final MessageRequestService messageRequestService;

    @PostMapping
    public ApiResponse<MessageRequestView> createRequest(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody CreateRequestRequest request) {
        MessageRequestView created = messageRequestService.createRequest(currentUser, request.receiver(),
                request.firstMessage());
        return new ApiResponse<>("Message request sent", created);
    }

    @GetMapping
    public ApiResponse<List<MessageRequestView>> listPending(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Pending requests fetched", messageRequestService.listPendingRequests(currentUser));
    }

    @PutMapping("/{id}/accept")
    public ApiResponse<MessageRequestView> accept(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return new ApiResponse<>("Message request accepted", messageRequestService.acceptRequest(currentUser, id));
    }

    @PutMapping("/{id}/decline")
    public ApiResponse<MessageRequestView> decline(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return new ApiResponse<>("Message request declined", messageRequestService.declineRequest(currentUser, id));
    }

/**
 * Immutable data carrier for create request request.
 */
    public record CreateRequestRequest(@NotNull Long receiver, @NotNull String firstMessage) {
    }
}
