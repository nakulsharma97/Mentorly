package com.skillswap.verification;

import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.mentorcertification.MentorCertificationDto;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MentorVerificationController.class)
@AutoConfigureMockMvc(addFilters = false)
class MentorVerificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MentorVerificationService service;
    @MockitoBean
    private MentorVerificationRequestRepository requestRepository;
    @MockitoBean
    private UserRepository userRepository;
    @MockitoBean
    private EmailNotificationService emailNotificationService;
    @MockitoBean
    private NotificationService notificationService;

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
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;
    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private User adminUser;
    private User learnerUser;
    private User mentorUser;
    private MentorVerificationRequest request;

    @BeforeEach
    void setUp() {
        adminUser = new User();
        adminUser.setId(1L);
        adminUser.setEmail("admin@skillswap.com");
        adminUser.setFullName("Admin User");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
        adminUser.setEnabled(true);

        learnerUser = new User();
        learnerUser.setId(10L);
        learnerUser.setEmail("learner@test.com");
        learnerUser.setUsername("newlearner");
        learnerUser.setFullName("New Learner");
        learnerUser.setRole(UserRole.LEARNER);
        learnerUser.setEnabled(true);

        mentorUser = new User();
        mentorUser.setId(20L);
        mentorUser.setEmail("mentor@test.com");
        mentorUser.setUsername("testmentor");
        mentorUser.setFullName("Test Mentor");
        mentorUser.setRole(UserRole.MENTOR);
        mentorUser.setYearsOfExperience(5);
        mentorUser.setCompany("Acme Inc");
        mentorUser.setHeadline("Senior Engineer");
        mentorUser.setResumeUrl("https://example.com/resume.pdf");
        mentorUser.setMentorVerified(false);
        mentorUser.setEnabled(true);
        mentorUser.setCreatedAt(OffsetDateTime.now().minusDays(60));

        request = new MentorVerificationRequest();
        request.setId(1L);
        request.setMentor(mentorUser);
        request.setFullName("Test Mentor");
        request.setEmail("mentor@test.com");
        request.setSkills("Java, Spring Boot");
        request.setYearsOfExperience(5);
        request.setDocumentUrl("https://example.com/id-card.pdf");
        request.setDocumentType("government_id");
        request.setStatus(MentorVerificationRequestStatus.PENDING);
        request.setCreatedAt(OffsetDateTime.now().minusDays(2));
        request.setUpdatedAt(OffsetDateTime.now().minusDays(2));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(User user) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /request
    // ══════════════════════════════════════════════════════════════

    @Test
    void submit_createsPendingRequest_forLearner() throws Exception {
        loginAs(learnerUser);

        MentorVerificationRequest saved = cloneRequest();
        saved.setStatus(MentorVerificationRequestStatus.PENDING);
        when(service.submit(eq(learnerUser), any(MentorVerificationDtos.SubmitMentorVerificationRequest.class)))
                .thenReturn(MentorVerificationDto.from(saved, List.of(), List.of()));

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "New Learner",
                                  "email": "learner@test.com",
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
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Verification request submitted"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.mentor.id").value(20))
                .andExpect(jsonPath("$.data.mentor.email").value("mentor@test.com"))
                .andExpect(jsonPath("$.data.mentor.passwordHash").doesNotExist());
    }

    @Test
    void submit_delegatesDuplicateCheck_toService() throws Exception {
        loginAs(mentorUser);

        org.mockito.Mockito.doThrow(new IllegalArgumentException("You already have a pending verification request"))
                .when(service).submit(eq(mentorUser), any());

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"documentUrl": "https://example.com/another.pdf", "documentType": "government_id"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("You already have a pending verification request"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /status (mentor dashboard banner)
    // ══════════════════════════════════════════════════════════════

    @Test
    void status_returnsLatestRequest_andMentorVerifiedFlag() throws Exception {
        loginAs(mentorUser);

        when(service.latestFor(mentorUser)).thenReturn(request);

        mockMvc.perform(get("/api/v1/verification/mentor/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification status fetched"))
                .andExpect(jsonPath("$.data.requestId").value(1))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.mentorVerified").value(false));
    }

    @Test
    void status_returnsNulls_whenNeverApplied() throws Exception {
        loginAs(learnerUser);

        when(service.latestFor(learnerUser)).thenReturn(null);

        mockMvc.perform(get("/api/v1/verification/mentor/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestId").doesNotExist())
                .andExpect(jsonPath("$.data.mentorVerified").value(false));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /requests (admin queue)
    // ══════════════════════════════════════════════════════════════

    @Test
    void moderationQueue_returnsPendingRequests_forAdmin() throws Exception {
        loginAs(adminUser);

        when(service.moderationQueue(adminUser, MentorVerificationRequestStatus.PENDING))
                .thenReturn(List.of(MentorVerificationDto.from(request, List.of(), List.of())));

        mockMvc.perform(get("/api/v1/verification/mentor/requests?status=PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification moderation queue fetched"))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].status").value("PENDING"))
                .andExpect(jsonPath("$.data[0].mentor.fullName").value("Test Mentor"))
                .andExpect(jsonPath("$.data[0].mentor.yearsOfExperience").value(5))
                .andExpect(jsonPath("$.data[0].mentor.resumeUrl").value("https://example.com/resume.pdf"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /requests/{id} (admin detail)
    // ══════════════════════════════════════════════════════════════

    @Test
    void requestDetail_returnsFullReview_forAdmin() throws Exception {
        loginAs(adminUser);

        when(service.requestDetail(adminUser, 1L))
                .thenReturn(MentorVerificationDto.from(request, List.of(), List.of()));

        mockMvc.perform(get("/api/v1/verification/mentor/requests/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification request fetched"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.documentUrl").value("https://example.com/id-card.pdf"))
                .andExpect(jsonPath("$.data.documentType").value("government_id"))
                .andExpect(jsonPath("$.data.requestedInfo").doesNotExist());
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /requests/{id} (approve / reject / more info)
    // ══════════════════════════════════════════════════════════════

    @Test
    void approve_setsMentorVerified_savesStatus_andNotifies() throws Exception {
        loginAs(adminUser);

        MentorVerificationRequest saved = cloneRequest();
        saved.setStatus(MentorVerificationRequestStatus.APPROVED);
        saved.setAdminNote("Looks good");
        saved.setReviewedBy(adminUser.getId());
        saved.setReviewedAt(OffsetDateTime.now());
        saved.setUpdatedAt(OffsetDateTime.now());

        when(service.updateStatus(eq(adminUser), eq(1L), any()))
                .thenReturn(MentorVerificationDto.from(saved, List.of(), List.of()));

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "APPROVED", "adminNote": "Looks good"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification request updated"))
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.adminNote").value("Looks good"))
                .andExpect(jsonPath("$.data.reviewedBy").value(1));

        verify(service).updateStatus(eq(adminUser), eq(1L), any());
    }

    @Test
    void reject_savesReason_revokesVerified_andNotifies() throws Exception {
        loginAs(adminUser);

        MentorVerificationRequest saved = cloneRequest();
        saved.setStatus(MentorVerificationRequestStatus.REJECTED);
        saved.setAdminNote("Document could not be verified");
        saved.setReviewedBy(adminUser.getId());
        saved.setReviewedAt(OffsetDateTime.now());
        saved.setUpdatedAt(OffsetDateTime.now());

        when(service.updateStatus(eq(adminUser), eq(1L), any()))
                .thenReturn(MentorVerificationDto.from(saved, List.of(), List.of()));

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED", "adminNote": "Document could not be verified"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adminNote").value("Document could not be verified"));

        verify(service).updateStatus(eq(adminUser), eq(1L), any());
    }

    @Test
    void requestMoreInfo_storesRequestedInfo_andNotifies() throws Exception {
        loginAs(adminUser);

        MentorVerificationRequest saved = cloneRequest();
        saved.setStatus(MentorVerificationRequestStatus.MORE_INFORMATION_REQUIRED);
        saved.setRequestedInfo("Please upload a recent government ID and a second certificate.");
        saved.setReviewedBy(adminUser.getId());
        saved.setReviewedAt(OffsetDateTime.now());
        saved.setUpdatedAt(OffsetDateTime.now());

        when(service.updateStatus(eq(adminUser), eq(1L), any()))
                .thenReturn(MentorVerificationDto.from(saved, List.of(), List.of()));

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "MORE_INFORMATION_REQUIRED",
                                  "requestedInfo": "Please upload a recent government ID and a second certificate."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("MORE_INFORMATION_REQUIRED"))
                .andExpect(jsonPath("$.data.requestedInfo")
                        .value("Please upload a recent government ID and a second certificate."));

        verify(service).updateStatus(eq(adminUser), eq(1L), any());
    }

    private MentorVerificationRequest cloneRequest() {
        MentorVerificationRequest copy = new MentorVerificationRequest();
        copy.setId(request.getId());
        copy.setMentor(request.getMentor());
        copy.setFullName(request.getFullName());
        copy.setEmail(request.getEmail());
        copy.setSkills(request.getSkills());
        copy.setYearsOfExperience(request.getYearsOfExperience());
        copy.setDocumentUrl(request.getDocumentUrl());
        copy.setDocumentType(request.getDocumentType());
        copy.setStatus(request.getStatus());
        copy.setCreatedAt(request.getCreatedAt());
        copy.setUpdatedAt(request.getUpdatedAt());
        return copy;
    }
}
