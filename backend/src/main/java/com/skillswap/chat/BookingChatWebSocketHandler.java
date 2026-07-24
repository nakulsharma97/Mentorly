package com.skillswap.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.auth.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.http.HttpHeaders;
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
public class BookingChatWebSocketHandler extends TextWebSocketHandler {

    private static final String ATTR_BOOKING_ID = "bookingId";
    private static final String ATTR_USER_EMAIL = "userEmail";

    private final ObjectMapper objectMapper;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final ChatService chatService;

    private final Map<Long, Set<WebSocketSession>> bookingRooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        var params = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        String bookingIdRaw = params.getFirst("bookingId");

        if (bookingIdRaw == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        Long bookingId;
        try {
            bookingId = Long.parseLong(bookingIdRaw);
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
            chatService.ensureParticipant(email, bookingId);
        } catch (Exception ex) {
            log.warn("Booking chat auth failed: bookingId={}", bookingIdRaw, ex);
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }

        session.getAttributes().put(ATTR_BOOKING_ID, bookingId);
        session.getAttributes().put(ATTR_USER_EMAIL, email);

        bookingRooms.computeIfAbsent(bookingId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
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
        Long bookingId = (Long) session.getAttributes().get(ATTR_BOOKING_ID);
        String userEmail = (String) session.getAttributes().get(ATTR_USER_EMAIL);
        if (bookingId == null || userEmail == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        JsonNode node;
        try {
            node = objectMapper.readTree(message.getPayload());
        } catch (Exception ex) {
            log.warn("Invalid booking chat message payload", ex);
            session.sendMessage(new TextMessage("{\"error\":\"Invalid message payload\"}"));
            return;
        }

        String type = node.path("type").asText("TEXT").toUpperCase();

        if ("PING".equals(type)) {
            String pongPayload = objectMapper.writeValueAsString(Map.of("type", "PONG"));
            session.sendMessage(new TextMessage(pongPayload));
            return;
        }

        if ("READ".equals(type)) {
            chatService.markAllAsRead(bookingId, userEmail);
            String readAckPayload = objectMapper.writeValueAsString(Map.of(
                    "type", "READ_ACK",
                    "readByEmail", userEmail,
                    "bookingId", bookingId));
            broadcastToOthers(bookingId, session, readAckPayload);
            return;
        }

        if ("TYPING".equals(type)) {
            String typingPayload = objectMapper.writeValueAsString(Map.of(
                    "type", "TYPING",
                    "typingUserEmail", userEmail,
                    "bookingId", bookingId));
            broadcastToOthers(bookingId, session, typingPayload);
            return;
        }

        String content = node.path("content").asText("");
        ChatService.ChatMessageView saved = chatService.createMessage(userEmail, bookingId, content);
        String payload = objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "message", saved));

        broadcastToRoom(bookingId, payload);
    }

    private void broadcastToRoom(Long bookingId, String payload) throws IOException {
        Set<WebSocketSession> room = bookingRooms.getOrDefault(bookingId, Set.of());
        for (WebSocketSession member : room) {
            if (member.isOpen()) {
                member.sendMessage(new TextMessage(payload));
            }
        }
    }

    private void broadcastToOthers(Long bookingId, WebSocketSession senderSession, String payload) throws IOException {
        Set<WebSocketSession> room = bookingRooms.getOrDefault(bookingId, Set.of());
        for (WebSocketSession member : room) {
            if (member.isOpen() && member != senderSession) {
                member.sendMessage(new TextMessage(payload));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object bookingIdObj = session.getAttributes().get(ATTR_BOOKING_ID);
        if (!(bookingIdObj instanceof Long bookingId)) {
            return;
        }

        Set<WebSocketSession> room = bookingRooms.get(bookingId);
        if (room == null) {
            return;
        }

        room.remove(session);
        if (room.isEmpty()) {
            bookingRooms.remove(bookingId);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws IOException {
        log.warn("Chat websocket transport error: {}", exception.getMessage());
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }
}
