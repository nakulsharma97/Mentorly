package com.skillswap.messaging;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/message-requests")
@RequiredArgsConstructor
public class MessageRequestController {

    private final MessageRequestService messageRequestService;

    @PostMapping
    public ApiResponse<MessageRequest> createRequest(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody CreateRequestRequest request) {
        MessageRequest created = messageRequestService.createRequest(currentUser, request.receiver(),
                request.firstMessage());
        return new ApiResponse<>("Message request sent", created);
    }

    @GetMapping
    public ApiResponse<List<MessageRequest>> listPending(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Pending requests fetched", messageRequestService.listPendingRequests(currentUser));
    }

    @PutMapping("/{id}/accept")
    public ApiResponse<MessageRequest> accept(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return new ApiResponse<>("Message request accepted", messageRequestService.acceptRequest(currentUser, id));
    }

    @PutMapping("/{id}/decline")
    public ApiResponse<MessageRequest> decline(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return new ApiResponse<>("Message request declined", messageRequestService.declineRequest(currentUser, id));
    }

    public record CreateRequestRequest(@NotNull Long receiver, @NotNull String firstMessage) {
    }
}
