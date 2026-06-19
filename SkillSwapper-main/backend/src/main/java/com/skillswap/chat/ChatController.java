package com.skillswap.chat;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/booking/{bookingId}")
    public ApiResponse<List<ChatService.ChatMessageView>> list(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId) {
        return new ApiResponse<>("Chat history fetched", chatService.listMessages(user, bookingId));
    }

    @PostMapping("/booking/{bookingId}")
    public ApiResponse<ChatService.ChatMessageView> create(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId,
            @RequestBody SendMessageRequest request) {
        return new ApiResponse<>("Message sent", chatService.createMessage(user, bookingId, request.content()));
    }

    public record SendMessageRequest(String content) {
    }
}
