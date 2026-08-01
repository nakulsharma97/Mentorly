package com.skillswap.files;

import com.skillswap.config.CsrfCookieFilter;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FileUploadController.class)
@AutoConfigureMockMvc(addFilters = false)
class FileUploadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;
    @MockitoBean
    private RequestTraceFilter requestTraceFilter;
    @MockitoBean
    private MaintenanceModeFilter maintenanceModeFilter;
    @MockitoBean
    private CsrfCookieFilter csrfCookieFilter;
    @MockitoBean
    private UserDetailsService userDetailsService;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;
    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setEmail("learner@test.com");
        user.setRole(UserRole.LEARNER);
        user.setEnabled(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void upload_rejectsSvgFile() throws Exception {
        MockMultipartFile svg = new MockMultipartFile(
                "file",
                "evil.svg",
                "image/svg+xml",
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload").file(svg))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("File type not allowed. Supported types: images, documents, audio, and common web formats."));
    }

    @Test
    void upload_rejectsSvgViaContentTypeSpoof() throws Exception {
        // Even with a benign-looking extension, an SVG content-type must be rejected.
        MockMultipartFile svg = new MockMultipartFile(
                "file",
                "photo.png",
                "image/svg+xml",
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload").file(svg))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upload_rejectsExecutableExtension() throws Exception {
        MockMultipartFile exe = new MockMultipartFile(
                "file",
                "payload.exe",
                MediaType.APPLICATION_OCTET_STREAM_VALUE,
                "MZ".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload").file(exe))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upload_rejectsUnAuthenticatedRequest() throws Exception {
        SecurityContextHolder.clearContext();

        MockMultipartFile png = new MockMultipartFile(
                "file",
                "image.png",
                "image/png",
                new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/v1/files/upload").file(png))
                .andExpect(status().isBadRequest());
    }
}
