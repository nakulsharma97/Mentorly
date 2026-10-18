package com.mentorly.meeting.google;

import com.mentorly.auth.OAuth2LoginFailureHandler;
import com.mentorly.auth.OAuth2LoginSuccessHandler;
import com.mentorly.config.EndpointRateLimitFilter;
import com.mentorly.config.JwtAuthenticationFilter;
import com.mentorly.config.MaintenanceModeFilter;
import com.mentorly.config.RequestTraceFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller tests for the Google Calendar OAuth handshake.
 *
 * <p>The security filter chain is disabled in this slice
 * ({@code addFilters = false}); the ADMIN-only rule for
 * {@code /api/v1/admin/**} lives in {@code SecurityConfig} and is covered by the
 * security integration tests. What matters here is the OAuth {@code state}
 * validation and the redirect contract.
 */
@WebMvcTest(GoogleCalendarAuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@TestPropertySource(properties = "app.frontend-base-url=https://mentorly.test")
class GoogleCalendarAuthControllerTest {

    private static final String CALLBACK_PATH = "/api/v1/admin/google-calendar/callback";
    private static final String CONNECT_PATH = "/api/v1/admin/google-calendar/connect";
    private static final String CONNECT_URL_PATH = "/api/v1/admin/google-calendar/connect-url";
    private static final String STATUS_PATH = "/api/v1/admin/google-calendar/status";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GoogleCalendarProperties properties;

    @MockitoBean
    private GoogleOAuthTokenManager tokenManager;

    // Filters / beans required to build the security configuration in a slice.
    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;
    @MockitoBean
    private RequestTraceFilter requestTraceFilter;
    @MockitoBean
    private MaintenanceModeFilter maintenanceModeFilter;
    @MockitoBean
    private UserDetailsService userDetailsService;
    @MockitoBean
    private OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    @MockitoBean
    private OAuth2LoginFailureHandler oAuth2LoginFailureHandler;
    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    /* ── /callback state validation ──────────────────────────────────── */

    @Test
    void callbackWithValidStateExchangesCodeAndRedirectsConnected() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY, "expected-state");
        when(tokenManager.authenticate("auth-code")).thenReturn(true);

        mockMvc.perform(get(CALLBACK_PATH)
                        .param("code", "auth-code")
                        .param("state", "expected-state")
                        .session(session))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=connected"));

        verify(tokenManager).authenticate("auth-code");
        assertThat(session.getAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY)).isNull();
    }

    @Test
    void callbackWithMismatchedStateIsRejectedWithoutExchangingTheCode() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY, "expected-state");

        mockMvc.perform(get(CALLBACK_PATH)
                        .param("code", "attacker-code")
                        .param("state", "forged-state")
                        .session(session))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=error"));

        verify(tokenManager, never()).authenticate(anyString());
    }

    @Test
    void callbackWithoutSessionStateIsRejected() throws Exception {
        mockMvc.perform(get(CALLBACK_PATH)
                        .param("code", "auth-code")
                        .param("state", "expected-state"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=error"));

        verify(tokenManager, never()).authenticate(anyString());
    }

    @Test
    void callbackStateCannotBeReplayed() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY, "expected-state");
        when(tokenManager.authenticate("auth-code")).thenReturn(true);

        mockMvc.perform(get(CALLBACK_PATH)
                        .param("code", "auth-code")
                        .param("state", "expected-state")
                        .session(session))
                .andExpect(status().isFound());

        // Google (or an attacker) replaying the same URL must not succeed again.
        mockMvc.perform(get(CALLBACK_PATH)
                        .param("code", "auth-code")
                        .param("state", "expected-state")
                        .session(session))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=error"));
    }

    @Test
    void callbackRedirectsErrorWhenTokenExchangeFails() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY, "expected-state");
        when(tokenManager.authenticate("auth-code")).thenReturn(false);

        mockMvc.perform(get(CALLBACK_PATH)
                        .param("code", "auth-code")
                        .param("state", "expected-state")
                        .session(session))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=error"));
    }

    @Test
    void callbackWithoutCodeRedirectsError() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY, "expected-state");

        mockMvc.perform(get(CALLBACK_PATH)
                        .param("state", "expected-state")
                        .session(session))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=error"));

        verify(tokenManager, never()).authenticate(anyString());
    }

    /* ── /connect + /connect-url ─────────────────────────────────────── */

    @Test
    void connectRedirectsToGoogleAndStoresStateInSession() throws Exception {
        MockHttpSession session = new MockHttpSession();
        when(properties.isConfigured()).thenReturn(true);
        when(tokenManager.buildAuthorizationUrl(anyString()))
                .thenReturn("https://accounts.google.com/o/oauth2/auth?client_id=test");

        mockMvc.perform(get(CONNECT_PATH).session(session))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "https://accounts.google.com/o/oauth2/auth?client_id=test"));

        assertThat(session.getAttribute(GoogleCalendarAuthController.STATE_SESSION_KEY))
                .isInstanceOf(String.class);
    }

    @Test
    void connectRedirectsWithErrorWhenIntegrationIsNotConfigured() throws Exception {
        when(properties.isConfigured()).thenReturn(false);

        mockMvc.perform(get(CONNECT_PATH))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://mentorly.test/admin?calendar=error"));

        verify(tokenManager, never()).buildAuthorizationUrl(anyString());
    }

    @Test
    void connectUrlReturnsAuthorizationUrl() throws Exception {
        when(properties.isConfigured()).thenReturn(true);
        when(tokenManager.buildAuthorizationUrl(anyString()))
                .thenReturn("https://accounts.google.com/o/oauth2/auth?client_id=test");

        mockMvc.perform(get(CONNECT_URL_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.url")
                        .value("https://accounts.google.com/o/oauth2/auth?client_id=test"));
    }

    @Test
    void connectUrlReturnsEmptyUrlWhenNotConfigured() throws Exception {
        when(properties.isConfigured()).thenReturn(false);

        mockMvc.perform(get(CONNECT_URL_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Google Calendar is not configured"))
                .andExpect(jsonPath("$.data.url").value(""));
    }

    /* ── /status ─────────────────────────────────────────────────────── */

    @Test
    void statusReportsConfiguredAndConnected() throws Exception {
        when(properties.isConfigured()).thenReturn(true);
        when(tokenManager.hasValidToken()).thenReturn(true);

        mockMvc.perform(get(STATUS_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configured").value(true))
                .andExpect(jsonPath("$.data.connected").value(true));
    }

    @Test
    void statusReportsNotConnectedWhenCalendarIsUnconfigured() throws Exception {
        when(properties.isConfigured()).thenReturn(false);

        mockMvc.perform(get(STATUS_PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configured").value(false))
                .andExpect(jsonPath("$.data.connected").value(false));

        verifyNoInteractions(tokenManager);
    }
}
