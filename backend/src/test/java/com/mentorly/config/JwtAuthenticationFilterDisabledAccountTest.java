package com.mentorly.config;

import com.mentorly.auth.AccessTokenDenylistRepository;
import com.mentorly.auth.JwtService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A valid access token must stop working the moment the account is disabled.
 * Without this, admin "Disable" only blocks the next login while the current
 * token keeps working for up to its full lifetime.
 */
class JwtAuthenticationFilterDisabledAccountTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final AccessTokenDenylistRepository accessTokenDenylistRepository =
            mock(AccessTokenDenylistRepository.class);
    private final UserDetailsService userDetailsService = mock(UserDetailsService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtService, accessTokenDenylistRepository, userDetailsService,
                userRepository, transactionManager);
        when(jwtService.isAccessToken("token-abc")).thenReturn(true);
        when(jwtService.extractJwtId("token-abc")).thenReturn("jti-1");
        when(jwtService.extractUsername("token-abc")).thenReturn("learner@test.com");
        when(accessTokenDenylistRepository.existsByJtiAndExpiresAtAfter(anyString(), any()))
                .thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static User user(boolean enabled) {
        User user = new User();
        user.setId(7L);
        user.setEmail("learner@test.com");
        user.setFullName("Learner Seven");
        user.setRole(UserRole.LEARNER);
        user.setEnabled(enabled);
        user.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return user;
    }

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/me");
        request.addHeader("Authorization", "Bearer token-abc");
        return request;
    }

    @Test
    void disabledAccountIsRejectedWith401AccountDisabled() throws Exception {
        User disabled = user(false);
        when(userDetailsService.loadUserByUsername("learner@test.com")).thenReturn(disabled);
        when(jwtService.isTokenValid("token-abc", disabled)).thenReturn(true);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request(), response, chain);

        assertEquals(401, response.getStatus());
        String body = response.getContentAsString();
        assertTrue(body.contains("\"code\":\"ACCOUNT_DISABLED\""), body);
        assertTrue(body.contains("\"message\":\"Your account has been disabled.\""), body);
        // The chain must not continue: nothing downstream may treat this as
        // an authenticated request.
        assertNull(chain.getRequest(), "filter chain should not continue for a disabled account");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void enabledAccountStillAuthenticates() throws Exception {
        User enabled = user(true);
        when(userDetailsService.loadUserByUsername("learner@test.com")).thenReturn(enabled);
        when(jwtService.isTokenValid("token-abc", enabled)).thenReturn(true);

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request(), response, chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest(), "filter chain should continue for an enabled account");
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
