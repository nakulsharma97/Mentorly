package com.mentorly.config;

import com.mentorly.chat.BookingChatWebSocketHandler;
import com.mentorly.chat.DirectChatWebSocketHandler;
import com.mentorly.notification.NotificationWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;
import java.util.List;

/**
 * Encapsulates web socket.
 */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final BookingChatWebSocketHandler bookingChatWebSocketHandler;
    private final DirectChatWebSocketHandler directChatWebSocketHandler;
    private final NotificationWebSocketHandler notificationWebSocketHandler;

    /**
     * Comma-separated list of origins allowed to open WebSocket connections.
     * Defaults to local dev origins; override via
     * {@code APP_WEBSOCKET_ALLOWED_ORIGINS} (e.g. the deployed SPA origin) so
     * real-time chat/notifications work outside localhost.
     */
    @Value("${app.websocket.allowed-origins:http://localhost:5174,http://127.0.0.1:5174,http://localhost:8080}")
    private String allowedOrigins;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        List<String> origins = parseOrigins(allowedOrigins);
        registry.addHandler(bookingChatWebSocketHandler, "/ws/chat")
                .setAllowedOriginPatterns(origins.toArray(new String[0]));
        registry.addHandler(directChatWebSocketHandler, "/ws/chat/direct")
                .setAllowedOriginPatterns(origins.toArray(new String[0]));
        registry.addHandler(notificationWebSocketHandler, "/ws/notifications")
                .setAllowedOriginPatterns(origins.toArray(new String[0]));
    }

    private static List<String> parseOrigins(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
    }
}
