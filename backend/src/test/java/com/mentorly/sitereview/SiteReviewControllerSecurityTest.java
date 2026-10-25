package com.mentorly.sitereview;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mentorly.common.AuditLogService;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * URL-level rules for the site-review feature:
 * - /api/v1/site-reviews/** requires authentication (401 anonymous)
 * - /api/v1/admin/site-reviews/** requires ROLE_ADMIN (403 others)
 * - one review per user (409 duplicate), admins may not submit (400)
 * - admin approve/reject writes an audit-log entry
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:site-review-security-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class SiteReviewControllerSecurityTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @MockBean
    private ProfileCompletionGuard profileCompletionGuard;

    @MockBean
    private AuditLogService auditLogService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SiteReviewRepository siteReviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User admin;
    private User mentor;
    private User learner;

    private static final String VALID_BODY =
            "{\"rating\":5,\"title\":\"Great site\",\"comment\":\"Mentorly is genuinely great to use every day.\"}";

    @BeforeEach
    void setUp() {
        admin = createUser("sradmin", UserRole.ADMIN);
        mentor = createUser("srmentor", UserRole.MENTOR);
        learner = createUser("srlearner", UserRole.LEARNER);
    }

    // ── Anonymous ──────────────────────────────────────────────

    @Test
    void siteReviewEndpoint_rejectsAnonymousGet() throws Exception {
        mockMvc.perform(get("/api/v1/site-reviews/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void siteReviewEndpoint_rejectsAnonymousPost() throws Exception {
        mockMvc.perform(post("/api/v1/site-reviews")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    // ── Authenticated user flows ───────────────────────────────

    @Test
    void learner_canFetchOwnReview_emptyByDefault() throws Exception {
        mockMvc.perform(get("/api/v1/site-reviews/me").with(user(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Review fetched"));
    }

    @Test
    void learner_canCreateReview_andDuplicateGets409() throws Exception {
        mockMvc.perform(post("/api/v1/site-reviews")
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.rating").value(5));

        mockMvc.perform(post("/api/v1/site-reviews")
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.data.code").value("SITE_REVIEW_EXISTS"));
    }

    @Test
    void learner_invalidRatingGets400() throws Exception {
        mockMvc.perform(post("/api/v1/site-reviews")
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":9,\"comment\":\"A perfectly long comment here.\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void admin_cannotSubmitOwnReview() throws Exception {
        mockMvc.perform(post("/api/v1/site-reviews")
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isBadRequest());
    }

    // ── /api/v1/admin/site-reviews → ROLE_ADMIN only ───────────

    @Test
    void adminSiteReviews_rejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/admin/site-reviews"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminSiteReviews_rejectsLearner() throws Exception {
        mockMvc.perform(get("/api/v1/admin/site-reviews").with(user(learner)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminSiteReviews_rejectsMentorApprove() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/site-reviews/1/approve")
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminSiteReviews_allowsAdminList() throws Exception {
        mockMvc.perform(get("/api/v1/admin/site-reviews").with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Site reviews fetched"));
    }

    @Test
    void adminSiteReviews_unknownStatusFilterIs400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/site-reviews?status=NOT_A_STATUS").with(user(admin)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void admin_approveWritesAuditLogAndPublishesReview() throws Exception {
        SiteReview pending = new SiteReview();
        pending.setUser(learner);
        pending.setRating(4);
        pending.setComment("A solid platform for finding mentors to learn from.");
        pending.setStatus(SiteReviewStatus.PENDING);
        siteReviewRepository.save(pending);
        Long id = pending.getId();

        mockMvc.perform(patch("/api/v1/admin/site-reviews/" + id + "/approve")
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"Looks good\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.adminNote").value("Looks good"));

        verify(auditLogService).logAdmin(eq(admin), eq("APPROVE_SITE_REVIEW"), eq("SiteReview"), eq(id), anyString());

        SiteReview reloaded = siteReviewRepository.findById(id).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(SiteReviewStatus.APPROVED, reloaded.getStatus());
    }

    @Test
    void admin_rejectWritesAuditLog() throws Exception {
        SiteReview pending = new SiteReview();
        pending.setUser(learner);
        pending.setRating(1);
        pending.setComment("Short off topic text that is long enough though.");
        pending.setStatus(SiteReviewStatus.PENDING);
        siteReviewRepository.save(pending);
        Long id = pending.getId();

        mockMvc.perform(patch("/api/v1/admin/site-reviews/" + id + "/reject")
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"Spam\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        verify(auditLogService).logAdmin(eq(admin), eq("REJECT_SITE_REVIEW"), eq("SiteReview"), eq(id), anyString());
    }

    // ── Helpers ────────────────────────────────────────────────

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
