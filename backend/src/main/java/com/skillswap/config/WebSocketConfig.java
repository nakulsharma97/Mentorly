package com.skillswap.config;

import com.skillswap.chat.BookingChatWebSocketHandler;
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

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(bookingChatWebSocketHandler, "/ws/chat")
                .setAllowedOriginPatterns("http://localhost:5174", "http://127.0.0.1:5174");
    }
}
