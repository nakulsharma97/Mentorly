package com.mentorly.config;

import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the URL-level role rules configured in {@link SecurityConfig}:
 * - /api/v1/admin/** requires ROLE_ADMIN
 * - /api/v1/admin/bookings/** is reachable by MENTOR + ADMIN (booking approval)
 * - /api/v1/availability/my-slots/** stays restricted to MENTOR/TEACHER/ADMIN
 * - All other routes require an authenticated user
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:security-config-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.auth.cookies.secure=false",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545"
})
@Transactional
@Rollback
class SecurityConfigIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @MockBean
    private ProfileCompletionGuard profileCompletionGuard;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User mentor;
    private User learner;

    @BeforeEach
    void setUp() {
        admin = createUser("admin", UserRole.ADMIN);
        mentor = createUser("mentor", UserRole.MENTOR);
        learner = createUser("learner", UserRole.LEARNER);
    }

    // ═══════════════════════════════════════════════════════════
    //  /api/v1/admin/** → ROLE_ADMIN only
    // ═══════════════════════════════════════════════════════════

    @Test
    void adminEndpoint_allowsAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/admin/summary").with(user(admin)))
                .andExpect(status().isOk());
    }

    @Test
    void adminEndpoint_rejectsMentor() throws Exception {
        mockMvc.perform(get("/api/v1/admin/summary").with(user(mentor)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpoint_rejectsLearner() throws Exception {
        mockMvc.perform(get("/api/v1/admin/summary").with(user(learner)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpoint_rejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/admin/summary"))
                .andExpect(status().isUnauthorized());
    }

    // ═══════════════════════════════════════════════════════════
    //  /api/v1/admin/bookings/** → MENTOR + ADMIN (backward compat)
    // ═══════════════════════════════════════════════════════════

    @Test
    void bookingApprovalEndpoint_allowsMentor() throws Exception {
        // Security passes for MENTOR; the missing booking surfaces as 404,
        // proving the URL rule did NOT block the mentor.
        mockMvc.perform(post("/api/v1/admin/bookings/999999/approve")
                        .with(csrf())
                        .with(user(mentor)))
                .andExpect(status().isNotFound());
    }

    @Test
    void bookingApprovalEndpoint_allowsAdmin() throws Exception {
        mockMvc.perform(post("/api/v1/admin/bookings/999999/approve")
                        .with(csrf())
                        .with(user(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void bookingApprovalEndpoint_rejectsLearner() throws Exception {
        mockMvc.perform(post("/api/v1/admin/bookings/999999/approve")
                        .with(csrf())
                        .with(user(learner)))
                .andExpect(status().isForbidden());
    }

    // ═══════════════════════════════════════════════════════════
    //  /api/v1/availability/my-slots/** → MENTOR/TEACHER/ADMIN only
    // ═══════════════════════════════════════════════════════════

    @Test
    void mySlotsEndpoint_allowsMentor() throws Exception {
        mockMvc.perform(get("/api/v1/availability/my-slots").with(user(mentor)))
                .andExpect(status().isOk());
    }

    @Test
    void mySlotsEndpoint_rejectsLearner() throws Exception {
        mockMvc.perform(get("/api/v1/availability/my-slots").with(user(learner)))
                .andExpect(status().isForbidden());
    }

    // ═══════════════════════════════════════════════════════════
    //  Learner/mentor shared routes remain authenticated-only
    // ═══════════════════════════════════════════════════════════

    @Test
    void sharedLearnerRoute_allowsLearner() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/unread-count").with(user(learner)))
                .andExpect(status().isOk());
    }

    @Test
    void sharedLearnerRoute_allowsMentor() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/unread-count").with(user(mentor)))
                .andExpect(status().isOk());
    }

    @Test
    void sharedLearnerRoute_rejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/unread-count"))
                .andExpect(status().isUnauthorized());
    }

    // ═══════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════

    private User createUser(String prefix, UserRole role) {
        User user = new User();
        user.setEmail(prefix + "+" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(prefix + UUID.randomUUID().toString().substring(0, 6));
        user.setFullName(role.name() + " User " + UUID.randomUUID().toString().substring(0, 8));
        user.setEnabled(true);
        return userRepository.save(user);
    }
}
