package com.skillswap.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.net.URI;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression tests for the chat WebSocket handshake hardening: the JWT is
 * accepted ONLY via the httpOnly {@code access_token} cookie. A token
 * smuggled in the URL query string must never authenticate a session.
 */
@ExtendWith(MockitoExtension.class)
class ChatWebSocketAuthTest {

    private static final String VALID_TOKEN = "valid.jwt.access.token";

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private JwtService jwtService;

    @Mock
    private UserDetailsService userDetailsService;

    @Mock
    private ChatService chatService;

    @Mock
    private WebSocketSession session;

    private HttpHeaders cookieHeader() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.COOKIE,
                AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + VALID_TOKEN);
        return headers;
    }

    private UserDetails userDetails() {
        return new User("test@example.com", "password", List.of());
    }

    @Test
    void directChat_acceptsCookieAuthenticatedHandshake() throws Exception {
        UserDetails details = userDetails();
        when(session.getUri()).thenReturn(URI.create("ws://localhost/ws/chat/direct?conversationId=7"));
        when(session.getHandshakeHeaders()).thenReturn(cookieHeader());
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(jwtService.extractUsername(VALID_TOKEN)).thenReturn("test@example.com");
        when(userDetailsService.loadUserByUsername("test@example.com")).thenReturn(details);
        when(jwtService.isTokenValid(VALID_TOKEN, details)).thenReturn(true);

        DirectChatWebSocketHandler handler = new DirectChatWebSocketHandler(
                objectMapper, jwtService, userDetailsService, chatService);
        handler.afterConnectionEstablished(session);

        verify(session, never()).close(any(CloseStatus.class));
    }

    @Test
    void directChat_rejectsQueryTokenWithoutCookie() throws Exception {
        when(session.getUri()).thenReturn(URI.create(
                "ws://localhost/ws/chat/direct?conversationId=7&token=stolen.jwt"));
        when(session.getHandshakeHeaders()).thenReturn(HttpHeaders.EMPTY);

        DirectChatWebSocketHandler handler = new DirectChatWebSocketHandler(
                objectMapper, jwtService, userDetailsService, chatService);
        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
        verify(jwtService, never()).extractUsername(any());
    }

    @Test
    void bookingChat_acceptsCookieAuthenticatedHandshake() throws Exception {
        UserDetails details = userDetails();
        when(session.getUri()).thenReturn(URI.create("ws://localhost/ws/chat?bookingId=9"));
        when(session.getHandshakeHeaders()).thenReturn(cookieHeader());
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(jwtService.extractUsername(VALID_TOKEN)).thenReturn("test@example.com");
        when(userDetailsService.loadUserByUsername("test@example.com")).thenReturn(details);
        when(jwtService.isTokenValid(VALID_TOKEN, details)).thenReturn(true);

        BookingChatWebSocketHandler handler = new BookingChatWebSocketHandler(
                objectMapper, jwtService, userDetailsService, chatService);
        handler.afterConnectionEstablished(session);

        verify(session, never()).close(any(CloseStatus.class));
    }

    @Test
    void bookingChat_rejectsQueryTokenWithoutCookie() throws Exception {
        when(session.getUri()).thenReturn(URI.create(
                "ws://localhost/ws/chat?bookingId=9&token=stolen.jwt"));
        when(session.getHandshakeHeaders()).thenReturn(HttpHeaders.EMPTY);

        BookingChatWebSocketHandler handler = new BookingChatWebSocketHandler(
                objectMapper, jwtService, userDetailsService, chatService);
        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
        verify(jwtService, never()).extractUsername(any());
    }
}
