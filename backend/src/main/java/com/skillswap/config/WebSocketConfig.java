package com.skillswap.config;

import com.skillswap.chat.BookingChatWebSocketHandler;
import com.skillswap.chat.DirectChatWebSocketHandler;
import com.skillswap.notification.NotificationWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final BookingChatWebSocketHandler bookingChatWebSocketHandler;
    private final DirectChatWebSocketHandler directChatWebSocketHandler;
    private final NotificationWebSocketHandler notificationWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(bookingChatWebSocketHandler, "/ws/chat")
                .setAllowedOriginPatterns("http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:8080");
        registry.addHandler(directChatWebSocketHandler, "/ws/chat/direct")
                .setAllowedOriginPatterns("http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:8080");
        registry.addHandler(notificationWebSocketHandler, "/ws/notifications")
                .setAllowedOriginPatterns("http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:8080");
    }
}
