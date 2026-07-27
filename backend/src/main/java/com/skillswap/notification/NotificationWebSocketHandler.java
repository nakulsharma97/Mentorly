package com.skillswap.notification;

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

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    private static final String ATTR_USER_ID = "userId";

    private final Map<Long, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = authenticate(session);
        if (userId != null) {
            session.getAttributes().put(ATTR_USER_ID, userId);
            userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
            log.debug("Notification WS connected: user={}, session={}", userId, session.getId());
        } else {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = (Long) session.getAttributes().get(ATTR_USER_ID);
        if (userId != null) {
            Set<WebSocketSession> sessions = userSessions.get(userId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    userSessions.remove(userId);
                }
            }
            log.debug("Notification WS disconnected: user={}, session={}", userId, session.getId());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        Long userId = (Long) session.getAttributes().get(ATTR_USER_ID);
        log.warn("Notification WS transport error for user {}: {}", userId, exception.getMessage());
        try {
            session.close(CloseStatus.SERVER_ERROR);
        } catch (IOException e) {
            // ignore
        }
    }

    /**
     * Authenticate the session by extracting the JWT token from either:
     * 1. The Cookie header (same as chat handlers)
     * 2. A "token" query parameter (fallback for proxy environments)
     */
    private Long authenticate(WebSocketSession session) {
        try {
            String token = null;

            // Try Cookie header first
            String cookieHeader = session.getHandshakeHeaders().getFirst(HttpHeaders.COOKIE);
            if (cookieHeader != null) {
                token = extractAccessTokenFromCookie(cookieHeader);
            }

            // Fallback: extract token from query parameter (for proxy environments)
            if (token == null) {
                token = extractTokenFromQuery(session);
            }

            if (token == null) return null;

            String email = jwtService.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
            if (!jwtService.isTokenValid(token, userDetails)) return null;

            return jwtService.extractUserId(token);
        } catch (Exception ex) {
            log.warn("Notification WS auth failed: {}", ex.getMessage());
            return null;
        }
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

    private String extractTokenFromQuery(WebSocketSession session) {
        java.net.URI uri = session.getUri();
        if (uri == null) return null;
        var params = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        return params.getFirst("token");
    }

    /**
     * Broadcast a notification to all WebSocket sessions of a given user.
     */
    public void broadcastToUser(Long userId, AppNotification notification) {
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        NotificationPayload payload = NotificationPayload.from(notification);
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Failed to serialize notification for user {}: {}", userId, e.getMessage());
            return;
        }

        TextMessage message = new TextMessage(json);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(message);
                } catch (IOException e) {
                    log.warn("Failed to send notification to session {}: {}", session.getId(), e.getMessage());
                }
            }
        }
    }

    /**
     * Simple DTO for WebSocket broadcast — avoids serializing JPA lazy proxies.
     */
    public record NotificationPayload(
            Long id,
            String type,
            String title,
            String message,
            Long referenceId,
            boolean read,
            String createdAt
    ) {
        static NotificationPayload from(AppNotification n) {
            return new NotificationPayload(
                    n.getId(),
                    n.getType(),
                    n.getTitle(),
                    n.getMessage(),
                    n.getReferenceId(),
                    n.isRead(),
                    n.getCreatedAt() != null ? n.getCreatedAt().toString() : null
            );
        }
    }
}
