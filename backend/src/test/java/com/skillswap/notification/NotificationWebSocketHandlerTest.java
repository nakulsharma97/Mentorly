package com.skillswap.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression tests for the notification WebSocket handshake hardening: the
 * JWT is accepted ONLY via the httpOnly {@code access_token} cookie. A token
 * smuggled in the URL query string must never authenticate a session.
 */
@ExtendWith(MockitoExtension.class)
class NotificationWebSocketHandlerTest {

    private static final String VALID_TOKEN = "valid.jwt.access.token";

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private JwtService jwtService;

    @Mock
    private UserDetailsService userDetailsService;

    @Mock
    private WebSocketSession session;

    @InjectMocks
    private NotificationWebSocketHandler handler;

    private HttpHeaders cookieHeader() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.COOKIE,
                AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + VALID_TOKEN);
        return headers;
    }

    @Test
    void acceptsHandshakeAuthenticatedViaAccessTokenCookie() throws Exception {
        UserDetails details = new User("test@example.com", "password", List.of());
        when(session.getHandshakeHeaders()).thenReturn(cookieHeader());
        when(session.getAttributes()).thenReturn(new HashMap<>());
        when(jwtService.extractUsername(VALID_TOKEN)).thenReturn("test@example.com");
        when(userDetailsService.loadUserByUsername("test@example.com")).thenReturn(details);
        when(jwtService.isTokenValid(VALID_TOKEN, details)).thenReturn(true);
        when(jwtService.extractUserId(VALID_TOKEN)).thenReturn(42L);

        handler.afterConnectionEstablished(session);

        verify(session, never()).close(any(CloseStatus.class));
        assertThat(session.getAttributes()).containsEntry("userId", 42L);
    }

    @Test
    void rejectsHandshakeWithNoCookie() throws Exception {
        when(session.getHandshakeHeaders()).thenReturn(HttpHeaders.EMPTY);

        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
        verify(jwtService, never()).extractUsername(any());
    }

    @Test
    void rejectsHandshakeWithOnlyQueryTokenAndNoCookie() throws Exception {
        // A token in the URL query string must NEVER authenticate the session.
        // The handler must not even read the request URI: the query-token path
        // was fully removed in the hardening, and this verifies it stays gone.
        when(session.getHandshakeHeaders()).thenReturn(HttpHeaders.EMPTY);

        handler.afterConnectionEstablished(session);

        verify(session).close(any(CloseStatus.class));
        verify(session, never()).getUri();
        verify(jwtService, never()).extractUsername(any());
    }
}
