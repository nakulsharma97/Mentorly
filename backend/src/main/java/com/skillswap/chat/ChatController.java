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

    @GetMapping("/conversations")
    public ApiResponse<List<ChatService.ConversationDto>> listConversations(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String filter) {
        return new ApiResponse<>("Conversations fetched", chatService.listConversations(user, query, filter));
    }

    @GetMapping("/booking/{bookingId}")
    public ApiResponse<List<ChatService.ChatMessageView>> listMessages(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId) {
        return new ApiResponse<>("Chat history fetched", chatService.listMessages(user, bookingId, null, 50));
    }

    @PostMapping("/booking/{bookingId}")
    public ApiResponse<ChatService.ChatMessageView> create(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId,
            @RequestBody SendMessageRequest request) {
        return new ApiResponse<>("Message sent", chatService.createMessage(user, bookingId, request.content()));
    }

    @PutMapping("/booking/{bookingId}/read")
    public ApiResponse<Void> markRead(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId) {
        chatService.markAllAsRead(bookingId, user.getEmail());
        return new ApiResponse<>("Messages marked read", null);
    }

    // ── Direct conversations (not tied to bookings) ──

    @PostMapping("/direct/{targetUserId}")
    public ApiResponse<ChatService.DirectConversationResponse> createOrGetDirectConversation(
            @AuthenticationPrincipal User user,
            @PathVariable Long targetUserId) {
        return new ApiResponse<>("Conversation ready",
                chatService.createOrGetDirectConversation(user, targetUserId));
    }

    @GetMapping("/direct/conversations")
    public ApiResponse<List<ChatService.DirectConversationResponse>> listDirectConversations(
            @AuthenticationPrincipal User user) {
        return new ApiResponse<>("Direct conversations fetched",
                chatService.listDirectConversations(user));
    }

    @GetMapping("/direct/{conversationId}")
    public ApiResponse<ChatService.DirectConversationDetail> getDirectConversation(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId) {
        return new ApiResponse<>("Conversation fetched",
                chatService.getDirectConversation(user, conversationId));
    }

    @GetMapping("/direct/{conversationId}/messages")
    public ApiResponse<List<ChatService.DirectMessageView>> listDirectMessages(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId) {
        return new ApiResponse<>("Messages fetched",
                chatService.listDirectMessages(user, conversationId));
    }

    @PostMapping("/direct/{conversationId}/messages")
    public ApiResponse<ChatService.DirectMessageView> sendDirectMessage(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId,
            @RequestBody SendMessageRequest request) {
        return new ApiResponse<>("Message sent",
                chatService.sendDirectMessage(user, conversationId, request.content()));
    }

    public record SendMessageRequest(String content) {
    }
}
