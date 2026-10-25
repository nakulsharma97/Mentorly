package com.mentorly.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mentorly.config.ClientIpResolver;
import com.mentorly.user.UserRole;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifies how the OAuth success handler consumes the {@code oauth_signup_role}
 * cookie written by the signup form: only MENTOR / LEARNER are honored, every
 * malformed or privileged value is ignored, and the cookie is always cleared on
 * the response so it cannot leak into a later round trip.
 */
@ExtendWith(MockitoExtension.class)
class OAuth2LoginSuccessHandlerTest {

    private static final String REDIRECT = "https://mentorly.example/oauth/callback";
    private static final String CLIENT_IP = "203.0.113.7";
    private static final String COOKIE = "oauth_signup_role";

    @Mock
    private ObjectProvider<AuthService> authServiceProvider;

    @Mock
    private AuthCookieService authCookieService;

    @Mock
    private ClientIpResolver clientIpResolver;

    @Mock
    private AuthService authService;

    private OAuth2LoginSuccessHandler handler;

    @BeforeEach
    void setUp() {
        handler = new OAuth2LoginSuccessHandler(authServiceProvider, authCookieService, clientIpResolver);
        ReflectionTestUtils.setField(handler, "frontendRedirectUrl", REDIRECT);
        lenient().when(authServiceProvider.getObject()).thenReturn(authService);
        lenient().when(clientIpResolver.resolve(org.mockito.ArgumentMatchers.any()))
                .thenReturn(CLIENT_IP);
    }

    // ── Role passthrough ─────────────────────────────────────────────────────

    @Test
    void validMentorCookieIsPassedThroughAndCleared() throws Exception {
        MockHttpServletRequest request = requestWithCookie(new Cookie(COOKIE, "MENTOR"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        stubLoginReturning(UserRole.MENTOR);

        handler.onAuthenticationSuccess(request, response, token("google"));

        verify(authService).loginWithOAuth(eq("google"), anyMap(), eq(CLIENT_IP), eq(UserRole.MENTOR));
        assertEquals(REDIRECT, response.getRedirectedUrl());
        assertCookieCleared(response);
    }

    @Test
    void cookieValueIsParsedCaseInsensitively() throws Exception {
        MockHttpServletRequest request = requestWithCookie(new Cookie(COOKIE, "mentor"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        stubLoginReturning(UserRole.MENTOR);

        handler.onAuthenticationSuccess(request, response, token("google"));

        verify(authService).loginWithOAuth(eq("google"), anyMap(), eq(CLIENT_IP), eq(UserRole.MENTOR));
        assertCookieCleared(response);
    }

    @Test
    void learnerCookieIsPassedThrough() throws Exception {
        MockHttpServletRequest request = requestWithCookie(new Cookie(COOKIE, "LEARNER"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        stubLoginReturning(UserRole.LEARNER);

        handler.onAuthenticationSuccess(request, response, token("github"));

        verify(authService).loginWithOAuth(eq("github"), anyMap(), eq(CLIENT_IP), eq(UserRole.LEARNER));
        assertCookieCleared(response);
    }

    // ── Rejected / missing values ────────────────────────────────────────────

    @Test
    void adminCookieIsIgnored() throws Exception {
        MockHttpServletRequest request = requestWithCookie(new Cookie(COOKIE, "ADMIN"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        stubLoginReturningNull();

        handler.onAuthenticationSuccess(request, response, token("google"));

        verify(authService).loginWithOAuth(eq("google"), anyMap(), eq(CLIENT_IP), isNull());
        assertCookieCleared(response);
    }

    @Test
    void garbageCookieValueIsIgnored() throws Exception {
        MockHttpServletRequest request = requestWithCookie(new Cookie(COOKIE, "banana; DROP ROLE"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        stubLoginReturningNull();

        handler.onAuthenticationSuccess(request, response, token("github"));

        verify(authService).loginWithOAuth(eq("github"), anyMap(), eq(CLIENT_IP), isNull());
        assertCookieCleared(response);
    }

    @Test
    void missingCookiePassesNullRole() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        stubLoginReturningNull();

        handler.onAuthenticationSuccess(request, response, token("google"));

        verify(authService).loginWithOAuth(eq("google"), anyMap(), eq(CLIENT_IP), isNull());
        assertCookieCleared(response);
    }

    // ── Failure path ─────────────────────────────────────────────────────────

    @Test
    void rejectedLoginStillClearsCookieAndRedirectsWithError() throws Exception {
        MockHttpServletRequest request = requestWithCookie(new Cookie(COOKIE, "MENTOR"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(authService.loginWithOAuth(eq("google"), anyMap(), eq(CLIENT_IP), eq(UserRole.MENTOR)))
                .thenThrow(new IllegalArgumentException("Too many sign-in attempts."));

        handler.onAuthenticationSuccess(request, response, token("google"));

        assertNotNull(response.getRedirectedUrl());
        assertTrue(
                response.getRedirectedUrl().contains("error=oauth_login_failed"),
                "failure must redirect with the friendly error param");
        assertCookieCleared(response);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void stubLoginReturning(UserRole requestedRole) {
        when(authService.loginWithOAuth(anyString(), anyMap(), anyString(), eq(requestedRole)))
                .thenReturn(successResponse(requestedRole));
    }

    private void stubLoginReturningNull() {
        when(authService.loginWithOAuth(anyString(), anyMap(), anyString(), isNull(UserRole.class)))
                .thenReturn(successResponse(null));
    }

    private static AuthDtos.AuthResponse successResponse(UserRole role) {
        return new AuthDtos.AuthResponse(
                "access-token", "refresh-token", "user@example.com",
                role == null ? "LEARNER" : role.name(), "user", false);
    }

    private static MockHttpServletRequest requestWithCookie(Cookie cookie) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(cookie);
        return request;
    }

    private static OAuth2AuthenticationToken token(String provider) {
        OAuth2User principal = mock(OAuth2User.class);
        lenient().when(principal.getAttributes()).thenReturn(Map.of("email", "user@example.com"));
        return new OAuth2AuthenticationToken(
                principal, List.of(new SimpleGrantedAuthority("ROLE_USER")), provider);
    }

    private static void assertCookieCleared(MockHttpServletResponse response) {
        Cookie cleared = null;
        for (Cookie cookie : response.getCookies()) {
            if (COOKIE.equals(cookie.getName())) {
                cleared = cookie;
            }
        }
        assertNotNull(cleared, "signup-role cookie must be cleared on the response");
        assertEquals(0, cleared.getMaxAge(), "clearing requires Max-Age=0");
        assertEquals("/", cleared.getPath());
        assertEquals("", cleared.getValue());
    }
}
