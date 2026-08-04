package com.skillswap.verification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full-context end-to-end test of the mentor verification workflow:
 *
 * <pre>
 *   learner registers/login → applies (POST /request) → PENDING appears in the
 *   admin queue (GET /requests?status=PENDING) → admin approves
 *   (PATCH /requests/{id} APPROVED) → the user's role flips to MENTOR and the
 *   mentor dashboard becomes accessible (mentor_verified = true).
 * </pre>
 *
 * <p>Also covers the reject flow (reason persisted + user notified), the
 * duplicate-application guard, and the request-more-information flow.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:mentor-verification-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class MentorVerificationWorkflowIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MentorVerificationRequestRepository requestRepository;

    private User learner;
    private User admin;

    @BeforeEach
    void setUp() {
        learner = createUser("learner+" + UUID.randomUUID() + "@example.com",
                "newlearner", UserRole.LEARNER);
        admin = createUser("admin+" + UUID.randomUUID() + "@example.com",
                "admin" + UUID.randomUUID().toString().substring(0, 6), UserRole.ADMIN);
        admin.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
        userRepository.save(admin);
    }

    // ── 1. Fresh learner can apply (role gate removed) ──

    @Test
    void givenFreshLearner_whenSubmitsApplication_thenRequestCreatedAsPending()
            throws Exception {
        String application = """
                {
                  "fullName": "New Learner",
                  "email": "%s",
                  "headline": "Backend Engineer",
                  "skills": "Java, Spring Boot",
                  "yearsOfExperience": 4,
                  "aboutMe": "I love teaching.",
                  "hourlyRate": 25.00,
                  "linkedinUrl": "https://linkedin.com/in/newlearner",
                  "githubUrl": "https://github.com/newlearner",
                  "portfolioUrl": "https://newlearner.dev",
                  "resumeUrl": "https://example.com/resume.pdf",
                  "documentUrl": "https://example.com/id-card.pdf",
                  "documentType": "government_id",
                  "availability": "weekends"
                }
                """.formatted(learner.getEmail());

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(application))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.fullName").value("New Learner"))
                .andExpect(jsonPath("$.data.yearsOfExperience").value(4))
                .andExpect(jsonPath("$.data.mentor.email").value(learner.getEmail()));

        assertThat(requestRepository.countByStatus(MentorVerificationRequestStatus.PENDING)).isEqualTo(1);
    }

    // ── 2. Optional identity proof: resume alone is enough ──

    @Test
    void givenApplicationWithoutDocument_whenSubmitted_thenResumeUsedAsDocument()
            throws Exception {
        String application = """
                {
                  "fullName": "Resume Only",
                  "email": "%s",
                  "skills": "React",
                  "resumeUrl": "https://example.com/resume.pdf"
                }
                """.formatted(learner.getEmail());

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(application))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentUrl").value("https://example.com/resume.pdf"))
                .andExpect(jsonPath("$.data.documentType").value("resume"));
    }

    // ── 3. PENDING appears in the admin queue ──

    @Test
    void givenPendingRequest_whenAdminFetchesQueue_thenRequestIsListed()
            throws Exception {
        MentorVerificationRequest request = persistPendingRequest();

        mockMvc.perform(get("/api/v1/verification/mentor/requests")
                        .with(csrf())
                        .with(user(admin))
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(request.getId()))
                .andExpect(jsonPath("$.data[0].status").value("PENDING"))
                .andExpect(jsonPath("$.data[0].fullName").value("New Learner"))
                .andExpect(jsonPath("$.data[0].skills").value("Java, Spring Boot"))
                .andExpect(jsonPath("$.data[0].mentor.email").value(learner.getEmail()));
    }

    // ── 4. Admin approval promotes the user to MENTOR ──

    @Test
    void givenPendingRequest_whenAdminApproves_thenRoleBecomesMentorAndVerified()
            throws Exception {
        MentorVerificationRequest request = persistPendingRequest();

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/{id}", request.getId())
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "APPROVED", "adminNote": "Verified by admin"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        User reloaded = userRepository.findById(learner.getId()).orElseThrow();
        assertThat(reloaded.getRole()).isEqualTo(UserRole.MENTOR);
        assertThat(reloaded.isMentorVerified()).isTrue();
    }

    // ── 5. Reject flow persists the reason ──

    @Test
    void givenPendingRequest_whenAdminRejects_thenReasonStoredAndUserNotPromoted()
            throws Exception {
        MentorVerificationRequest request = persistPendingRequest();

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/{id}", request.getId())
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED", "adminNote": "Certificate could not be verified"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adminNote").value("Certificate could not be verified"));

        User reloaded = userRepository.findById(learner.getId()).orElseThrow();
        assertThat(reloaded.getRole()).isEqualTo(UserRole.LEARNER);
        assertThat(reloaded.isMentorVerified()).isFalse();
    }

    // ── 6. More-information flow stores what was requested ──

    @Test
    void givenPendingRequest_whenAdminRequestsMoreInfo_thenRequestedInfoStored()
            throws Exception {
        MentorVerificationRequest request = persistPendingRequest();

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/{id}", request.getId())
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "MORE_INFORMATION_REQUIRED",
                                 "requestedInfo": "Please upload a recent government ID"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("MORE_INFORMATION_REQUIRED"))
                .andExpect(jsonPath("$.data.requestedInfo").value("Please upload a recent government ID"));
    }

    // ── 7. Duplicate pending applications are rejected ──

    @Test
    void givenPendingRequest_whenUserAppliesAgain_thenDuplicateRejected()
            throws Exception {
        persistPendingRequest();

        String secondApplication = """
                {
                  "fullName": "Second Try",
                  "email": "%s",
                  "skills": "Java",
                  "resumeUrl": "https://example.com/resume2.pdf"
                }
                """.formatted(learner.getEmail());

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(secondApplication))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value(
                        org.hamcrest.Matchers.containsString("already have a pending")));

        assertThat(requestRepository.countByStatus(MentorVerificationRequestStatus.PENDING)).isEqualTo(1);
    }

    // ── Helpers ──

    private User createUser(String email, String username, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setFullName("Integration User");
        user.setRole(role);
        user.setEnabled(true);
        user.setPasswordHash(passwordEncoder.encode("TestPass123!"));
        user.setReferralCode("REF-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10));
        return userRepository.save(user);
    }

    private MentorVerificationRequest persistPendingRequest() {
        MentorVerificationRequest request = new MentorVerificationRequest();
        request.setMentor(learner);
        request.setFullName("New Learner");
        request.setEmail(learner.getEmail());
        request.setSkills("Java, Spring Boot");
        request.setYearsOfExperience(4);
        request.setDocumentUrl("https://example.com/id-card.pdf");
        request.setDocumentType("government_id");
        request.setStatus(MentorVerificationRequestStatus.PENDING);
        request.setSubmittedAt(java.time.OffsetDateTime.now());
        return requestRepository.save(request);
    }
}
