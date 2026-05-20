package com.skillswap.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
        String token = params.getFirst("token");
        String bookingIdRaw = params.getFirst("bookingId");

        if (token == null || bookingIdRaw == null) {
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
            email = jwtService.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(token, userDetails)) {
                session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
                return;
            }
            chatService.ensureParticipant(email, bookingId);
        } catch (Exception ex) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }

        session.getAttributes().put(ATTR_BOOKING_ID, bookingId);
        session.getAttributes().put(ATTR_USER_EMAIL, email);

        bookingRooms.computeIfAbsent(bookingId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Long bookingId = (Long) session.getAttributes().get(ATTR_BOOKING_ID);
        String userEmail = (String) session.getAttributes().get(ATTR_USER_EMAIL);
        if (bookingId == null || userEmail == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String content;
        try {
            JsonNode node = objectMapper.readTree(message.getPayload());
            content = node.path("content").asText("");
        } catch (Exception ex) {
            session.sendMessage(new TextMessage("{\"error\":\"Invalid message payload\"}"));
            return;
        }

        ChatService.ChatMessageView saved = chatService.createMessage(userEmail, bookingId, content);
        String payload = objectMapper.writeValueAsString(saved);

        Set<WebSocketSession> room = bookingRooms.getOrDefault(bookingId, Set.of());
        for (WebSocketSession member : room) {
            if (member.isOpen()) {
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
