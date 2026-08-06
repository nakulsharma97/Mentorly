package com.skillswap.chat;

import com.skillswap.common.ApiResponse;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing chat endpoints.
 */
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final DirectChatWebSocketHandler webSocketHandler;
    private final ProfileCompletionGuard profileCompletionGuard;

    @GetMapping("/conversations")
    public ApiResponse<List<ChatService.ConversationDto>> listConversations(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String filter) {
        return new ApiResponse<>("Conversations fetched", chatService.listConversations(user, query, filter));
    }

    /**
     * Unified backend search across booking chats and direct chats.
     * Matches participant name, username, email, skills, session title,
     * conversation id, booking id, and the last message preview.
     */
    @GetMapping("/search")
    public ApiResponse<List<ChatService.UnifiedConversationDto>> searchConversations(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false, defaultValue = "") String q) {
        return new ApiResponse<>("Conversations found", chatService.searchConversations(user, q));
    }

    /**
     * Backward-compatible alias used by older clients.
     */
    @GetMapping("/messages/search")
    public ApiResponse<List<ChatService.UnifiedConversationDto>> searchConversationsAlias(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false, defaultValue = "") String q) {
        return new ApiResponse<>("Conversations found", chatService.searchConversations(user, q));
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
        profileCompletionGuard.requireProfileCompleted(user,
                "Please complete your profile before messaging.");
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
        profileCompletionGuard.requireProfileCompleted(user,
                "Please complete your profile before messaging.");
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

    /**
     * Deletes one of the caller's own direct messages.
     */
    @DeleteMapping("/direct/{conversationId}/messages/{messageId}")
    public ApiResponse<Boolean> deleteDirectMessage(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId,
            @PathVariable Long messageId) {
        return new ApiResponse<>("Message deleted",
                chatService.deleteDirectMessage(user, conversationId, messageId));
    }

    /**
     * Deletes one of the caller's own booking-chat messages.
     */
    @DeleteMapping("/booking/{bookingId}/messages/{messageId}")
    public ApiResponse<Boolean> deleteBookingMessage(
            @AuthenticationPrincipal User user,
            @PathVariable Long bookingId,
            @PathVariable Long messageId) {
        return new ApiResponse<>("Message deleted",
                chatService.deleteBookingMessage(user, bookingId, messageId));
    }

    /**
     * Toggles an emoji reaction by the current user on a direct message.
     */
    @PostMapping("/direct/{conversationId}/messages/{messageId}/reactions")
    public ApiResponse<ChatService.DirectMessageView> toggleReaction(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @RequestBody ReactionRequest request) {
        ChatService.DirectMessageView updated = chatService.toggleReaction(user, conversationId, messageId,
                request.emoji());
        // Push the reaction update to all connected WebSocket sessions in real-time.
        webSocketHandler.broadcastReaction(conversationId, updated);
        return new ApiResponse<>("Reaction updated", updated);
    }

    /**
     * Pins or unpins a direct conversation.
     */
    @PutMapping("/direct/{conversationId}/pin")
    public ApiResponse<ChatService.DirectConversationResponse> setPinned(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId,
            @RequestBody PinRequest request) {
        return new ApiResponse<>("Conversation updated",
                chatService.setPinned(user, conversationId, request.pinned()));
    }

    /**
     * Archives or unarchives a direct conversation.
     */
    @PutMapping("/direct/{conversationId}/archive")
    public ApiResponse<ChatService.DirectConversationResponse> setArchived(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId,
            @RequestBody PinRequest request) {
        return new ApiResponse<>("Conversation updated",
                chatService.setArchived(user, conversationId, request.archived()));
    }

    @PostMapping("/direct/{conversationId}/messages")
    public ApiResponse<ChatService.DirectMessageView> sendDirectMessage(
            @AuthenticationPrincipal User user,
            @PathVariable Long conversationId,
            @RequestBody SendMessageRequest request) {
        profileCompletionGuard.requireProfileCompleted(user,
                "Please complete your profile before messaging.");
        ChatService.DirectMessageView saved = chatService.sendDirectMessage(user, conversationId, request.content());
        // Broadcast to all connected WebSocket sessions in real-time
        webSocketHandler.broadcastMessage(conversationId, saved);
        return new ApiResponse<>("Message sent", saved);
    }

    /**
     * Immutable data carrier for send message request.
     */
    public record SendMessageRequest(String content) {
    }

    /**
     * Immutable data carrier for reaction request.
     */
    public record ReactionRequest(String emoji) {
    }

    /**
     * Immutable data carrier for pin / archive request.
     */
    public record PinRequest(boolean pinned, boolean archived) {
    }
}
