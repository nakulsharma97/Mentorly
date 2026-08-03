package com.skillswap.auth;

import com.skillswap.common.GlobalExceptionHandler;
import com.skillswap.common.exception.ServiceGlobalExceptionHandler;
import com.skillswap.config.ClientIpResolver;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({ GlobalExceptionHandler.class, ServiceGlobalExceptionHandler.class })
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private AuthService authService;

  @MockitoBean
  private ClientIpResolver clientIpResolver;

  @MockitoBean
  private AuthCookieService authCookieService;

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

  @Test
  void signupReturnsSuccessResponse() throws Exception {
    when(authService.signup(any(), any())).thenReturn(
        new AuthDtos.AuthResponse("access", "refresh", "user@example.com",
            UserRole.LEARNER.name(), "testuser"));

    mockMvc.perform(post("/api/v1/auth/signup")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "email":"user@example.com",
              "password":"Password123!",
              "fullName":"User One",
              "role":"LEARNER",
              "username":"testuser"
            }
            """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Signup successful"))
        .andExpect(jsonPath("$.data.token").value("access"))
        .andExpect(jsonPath("$.data.refreshToken").value("refresh"))
        .andExpect(jsonPath("$.data.email").value("user@example.com"))
        .andExpect(jsonPath("$.data.role").value("LEARNER"));
  }

  @Test
  void loginForwardsResolverResolvedIpToService() throws Exception {
    when(clientIpResolver.resolve(any())).thenReturn("203.0.113.9");
    when(authService.login(any(), eq("203.0.113.9"))).thenReturn(
        new AuthDtos.AuthResponse("access", "refresh", "user@example.com",
            UserRole.LEARNER.name(), "testuser"));

    // The client sends a spoofed X-Forwarded-For header; the controller must
    // forward the resolver's trusted value, never the header itself.
    mockMvc.perform(post("/api/v1/auth/login")
        .header("X-Forwarded-For", "6.6.6.6, 203.0.113.9")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "email":"user@example.com",
              "password":"password123"
            }
            """))
        .andExpect(status().isOk());

    verify(authService).login(any(), eq("203.0.113.9"));
  }

  @Test
  void refreshAcceptsRefreshTokenCookieOnly() throws Exception {
    when(authService.refreshToken("cookie-refresh-token")).thenReturn(
        new AuthDtos.AuthResponse("new-access", "new-refresh", "user@example.com",
            UserRole.LEARNER.name(), "testuser"));

    mockMvc.perform(post("/api/v1/auth/refresh")
        .cookie(new jakarta.servlet.http.Cookie(
            AuthCookieService.REFRESH_TOKEN_COOKIE, "cookie-refresh-token")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("Token refreshed"))
        .andExpect(jsonPath("$.data.token").value("new-access"));

    verify(authService).refreshToken("cookie-refresh-token");
  }

  @Test
  void refreshRejectsBodyProvidedTokenWithoutCookie() throws Exception {
    // A missing refresh_token cookie means no session — the service guard
    // rejects the request with 400. A token smuggled in the request body must
    // never be honored (cookie-only endpoint).
    when(authService.refreshToken((String) null))
        .thenThrow(new IllegalArgumentException("Refresh token is required"));

    mockMvc.perform(post("/api/v1/auth/refresh")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "refreshToken": "body-refresh-token"
            }
            """))
        .andExpect(status().isBadRequest());

    verify(authService, never()).refreshToken("body-refresh-token");
  }

  @Test
  void loginRejectsInvalidPayload() throws Exception {
    mockMvc.perform(post("/api/v1/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "email":"not-an-email",
              "password":""
            }
            """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Request failed"))
        .andExpect(jsonPath("$.data.status").value(400))
        .andExpect(jsonPath("$.data.errors.password").value("must not be blank"));
  }
}
