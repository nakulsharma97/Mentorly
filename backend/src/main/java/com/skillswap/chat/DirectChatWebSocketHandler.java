package com.skillswap.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.auth.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class DirectChatWebSocketHandler extends TextWebSocketHandler {

    private static final String ATTR_CONVERSATION_ID = "conversationId";
    private static final String ATTR_USER_EMAIL = "userEmail";

    private final ObjectMapper objectMapper;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final ChatService chatService;

    private final Map<Long, Set<WebSocketSession>> conversationRooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        var params = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        String conversationIdRaw = params.getFirst("conversationId");

        if (conversationIdRaw == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        Long conversationId;
        try {
            conversationId = Long.parseLong(conversationIdRaw);
        } catch (NumberFormatException ex) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String email;
        try {
            String token = extractAccessTokenFromCookie(session.getHandshakeHeaders().getFirst(HttpHeaders.COOKIE));
            if (token == null) {
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
                return;
            }
            email = jwtService.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(token, userDetails)) {
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
                return;
            }
            // Validate the user is a participant in this conversation (lightweight check)
            chatService.isParticipantInConversation(email, conversationId);
        } catch (Exception ex) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }

        session.getAttributes().put(ATTR_CONVERSATION_ID, conversationId);
        session.getAttributes().put(ATTR_USER_EMAIL, email);

        conversationRooms.computeIfAbsent(conversationId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    private String extractAccessTokenFromCookie(String cookieHeader) {
        if (cookieHeader == null || cookieHeader.isBlank()) {
            return null;
        }

        String prefix = AuthCookieService.ACCESS_TOKEN_COOKIE + "=";
        String[] cookies = cookieHeader.split(";");
        for (String cookie : cookies) {
            String candidate = cookie.trim();
            if (candidate.startsWith(prefix)) {
                return candidate.substring(prefix.length());
            }
        }
        return null;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Long conversationId = (Long) session.getAttributes().get(ATTR_CONVERSATION_ID);
        String userEmail = (String) session.getAttributes().get(ATTR_USER_EMAIL);
        if (conversationId == null || userEmail == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        JsonNode node;
        try {
            node = objectMapper.readTree(message.getPayload());
        } catch (Exception ex) {
            session.sendMessage(new TextMessage("{\"error\":\"Invalid message payload\"}"));
            return;
        }

        String type = node.path("type").asText("TEXT").toUpperCase();

        if ("READ".equals(type)) {
            chatService.markDirectMessagesAsRead(conversationId, userEmail);
            String readAckPayload = objectMapper.writeValueAsString(Map.of(
                    "type", "READ_ACK",
                    "readByEmail", userEmail,
                    "conversationId", conversationId));
            broadcastToOthers(conversationId, session, readAckPayload);
            return;
        }

        if ("TYPING".equals(type)) {
            String typingPayload = objectMapper.writeValueAsString(Map.of(
                    "type", "TYPING",
                    "typingUserEmail", userEmail,
                    "conversationId", conversationId));
            broadcastToOthers(conversationId, session, typingPayload);
            return;
        }

        // Default: TEXT message
        String content = node.path("content").asText("");
        ChatService.DirectMessageView saved = chatService.sendDirectMessage(userEmail, conversationId, content);
        String payload = objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "message", saved));

        broadcastToRoom(conversationId, payload);
    }

    /**
     * Broadcast a message to all participants in a conversation room.
     * Used by the REST controller to push messages sent via HTTP
     * to all connected WebSocket sessions in real-time.
     */
    public void broadcastMessage(Long conversationId, ChatService.DirectMessageView message) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    "type", "TEXT",
                    "message", message));
            broadcastToRoom(conversationId, payload);
        } catch (IOException e) {
            log.warn("[broadcastMessage] Failed to broadcast message to conversation {}: {}", conversationId, e.getMessage());
        }
    }

    private void broadcastToRoom(Long conversationId, String payload) throws IOException {
        Set<WebSocketSession> room = conversationRooms.getOrDefault(conversationId, Set.of());
        for (WebSocketSession member : room) {
            if (member.isOpen()) {
                member.sendMessage(new TextMessage(payload));
            }
        }
    }

    private void broadcastToOthers(Long conversationId, WebSocketSession senderSession, String payload) throws IOException {
        Set<WebSocketSession> room = conversationRooms.getOrDefault(conversationId, Set.of());
        for (WebSocketSession member : room) {
            if (member.isOpen() && member != senderSession) {
                member.sendMessage(new TextMessage(payload));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object convIdObj = session.getAttributes().get(ATTR_CONVERSATION_ID);
        if (!(convIdObj instanceof Long conversationId)) {
            return;
        }

        Set<WebSocketSession> room = conversationRooms.get(conversationId);
        if (room == null) {
            return;
        }

        room.remove(session);
        if (room.isEmpty()) {
            conversationRooms.remove(conversationId);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws IOException {
        log.warn("Direct chat websocket transport error: {}", exception.getMessage());
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }
}
