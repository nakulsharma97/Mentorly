package com.skillswap.auth;

import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerIntegrationTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private AuthService authService;

        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @MockitoBean
        private EndpointRateLimitFilter endpointRateLimitFilter;

        @MockitoBean
        private RequestTraceFilter requestTraceFilter;

        @MockitoBean
        private UserDetailsService userDetailsService;

        @MockitoBean
        private OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

        @MockitoBean
        private OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

        @Test
        void signupReturnsSuccessResponse() throws Exception {
                when(authService.signup(any())).thenReturn(
                                new AuthDtos.AuthResponse("access", "refresh", "user@example.com",
                                                UserRole.LEARNER.name()));

                mockMvc.perform(post("/api/v1/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {
                                                  "email":"user@example.com",
                                                  "password":"password123",
                                                  "fullName":"User One",
                                                  "role":"LEARNER"
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
                                .andExpect(jsonPath("$.message").value("Validation failed"))
                                .andExpect(jsonPath("$.data.code").value("VALIDATION_ERROR"))
                                .andExpect(jsonPath("$.data.traceId").exists())
                                .andExpect(jsonPath("$.data.fieldErrors").isArray());
        }
}
