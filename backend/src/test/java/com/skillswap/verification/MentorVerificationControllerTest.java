package com.skillswap.verification;

import com.skillswap.common.AuditLogService;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.mentorcertification.MentorCertification;
import com.skillswap.mentorcertification.MentorCertificationDto;
import com.skillswap.mentorcertification.MentorCertificationService;
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

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
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
    private MentorVerificationRequestRepository requestRepository;
    @MockitoBean
    private UserRepository userRepository;
    @MockitoBean
    private MentorCertificationService certificationService;
    @MockitoBean
    private NotificationService notificationService;
    @MockitoBean
    private EmailNotificationService emailNotificationService;
    @MockitoBean
    private AuditLogService auditLogService;

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
    //  POST /request (mentor)
    // ══════════════════════════════════════════════════════════════

    @Test
    void submit_createsPendingRequest_forMentor() throws Exception {
        loginAs(mentorUser);

        when(requestRepository.findFirstByMentorIdAndStatusOrderByCreatedAtDesc(20L, MentorVerificationRequestStatus.PENDING))
                .thenReturn(Optional.empty());
        when(certificationService.listForMentor(20L)).thenReturn(List.of());
        when(requestRepository.save(any(MentorVerificationRequest.class))).thenReturn(request);

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"documentUrl": "https://example.com/id-card.pdf", "documentType": "government_id"}
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
    void submit_rejectsDuplicatePendingRequest() throws Exception {
        loginAs(mentorUser);

        when(requestRepository.findFirstByMentorIdAndStatusOrderByCreatedAtDesc(20L, MentorVerificationRequestStatus.PENDING))
                .thenReturn(Optional.of(request));

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"documentUrl": "https://example.com/another.pdf", "documentType": "government_id"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("You already have a pending verification request"));
    }

    @Test
    void submit_rejectsInvalidUrl() throws Exception {
        loginAs(mentorUser);

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"documentUrl": "not-a-url", "documentType": "government_id"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submit_rejectsNonMentor() throws Exception {
        User learner = new User();
        learner.setId(10L);
        learner.setEmail("learner@test.com");
        learner.setRole(UserRole.LEARNER);
        loginAs(learner);

        mockMvc.perform(post("/api/v1/verification/mentor/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"documentUrl": "https://example.com/id.pdf", "documentType": "government_id"}
                                """))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /requests (admin queue)
    // ══════════════════════════════════════════════════════════════

    @Test
    void moderationQueue_returnsPendingRequests_forAdmin() throws Exception {
        loginAs(adminUser);

        MentorCertification cert = new MentorCertification();
        cert.setId(7L);
        cert.setMentor(mentorUser);
        cert.setCertificationName("AWS Certified Developer");
        cert.setIssuingOrganization("Amazon Web Services");
        cert.setIssueDate(LocalDate.of(2023, 5, 1));
        cert.setCertificateImage("data:image/png;base64,AAAA");

        when(certificationService.listForMentor(20L)).thenReturn(List.of(certDto(cert)));
        when(requestRepository.findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus.PENDING))
                .thenReturn(List.of(request));

        mockMvc.perform(get("/api/v1/verification/mentor/requests?status=PENDING")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification moderation queue fetched"))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].mentor.fullName").value("Test Mentor"))
                .andExpect(jsonPath("$.data[0].mentor.yearsOfExperience").value(5))
                .andExpect(jsonPath("$.data[0].mentor.resumeUrl").value("https://example.com/resume.pdf"))
                .andExpect(jsonPath("$.data[0].certifications[0].certificationName")
                        .value("AWS Certified Developer"))
                .andExpect(jsonPath("$.data[0].certifications[0].certificateImage")
                        .value("data:image/png;base64,AAAA"));
    }

    @Test
    void moderationQueue_rejectsNonAdmin() throws Exception {
        loginAs(mentorUser);

        mockMvc.perform(get("/api/v1/verification/mentor/requests")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /requests/{id} (admin detail)
    // ══════════════════════════════════════════════════════════════

    @Test
    void requestDetail_returnsFullReview_forAdmin() throws Exception {
        loginAs(adminUser);

        when(certificationService.listForMentor(20L)).thenReturn(List.of());
        when(requestRepository.findById(1L)).thenReturn(Optional.of(request));

        mockMvc.perform(get("/api/v1/verification/mentor/requests/1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification request fetched"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.documentUrl").value("https://example.com/id-card.pdf"))
                .andExpect(jsonPath("$.data.documentType").value("government_id"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /requests/{id} (admin approve / reject)
    // ══════════════════════════════════════════════════════════════

    @Test
    void approve_setsMentorVerified_savesStatus_andNotifies() throws Exception {
        loginAs(adminUser);

        MentorVerificationRequest savedRequest = new MentorVerificationRequest();
        savedRequest.setId(1L);
        savedRequest.setMentor(mentorUser);
        savedRequest.setDocumentUrl(request.getDocumentUrl());
        savedRequest.setDocumentType(request.getDocumentType());
        savedRequest.setStatus(MentorVerificationRequestStatus.APPROVED);
        savedRequest.setAdminNote("Looks good");
        savedRequest.setReviewedBy(adminUser.getId());
        savedRequest.setReviewedAt(OffsetDateTime.now());
        savedRequest.setCreatedAt(request.getCreatedAt());
        savedRequest.setUpdatedAt(OffsetDateTime.now());

        when(requestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(certificationService.listForMentor(20L)).thenReturn(List.of());
        when(userRepository.save(any(User.class))).thenReturn(mentorUser);
        when(requestRepository.save(any(MentorVerificationRequest.class))).thenReturn(savedRequest);

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

        verify(userRepository).save(any(User.class));
        verify(emailNotificationService).sendVerificationApproved(mentorUser);
        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(20L),
                org.mockito.ArgumentMatchers.eq("MENTOR_VERIFICATION"),
                anyString(), anyString(), anyLong());

        // Approval must be recorded on the admin audit trail.
        verify(auditLogService).logAdmin(
                org.mockito.ArgumentMatchers.eq(adminUser),
                org.mockito.ArgumentMatchers.eq("MENTOR_VERIFICATION"),
                org.mockito.ArgumentMatchers.eq("MentorVerificationRequest"),
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void reject_savesReason_revokesVerified_andNotifies() throws Exception {
        loginAs(adminUser);

        mentorUser.setMentorVerified(true);

        MentorVerificationRequest savedRequest = new MentorVerificationRequest();
        savedRequest.setId(1L);
        savedRequest.setMentor(mentorUser);
        savedRequest.setDocumentUrl(request.getDocumentUrl());
        savedRequest.setDocumentType(request.getDocumentType());
        savedRequest.setStatus(MentorVerificationRequestStatus.REJECTED);
        savedRequest.setAdminNote("Document could not be verified");
        savedRequest.setReviewedBy(adminUser.getId());
        savedRequest.setReviewedAt(OffsetDateTime.now());
        savedRequest.setCreatedAt(request.getCreatedAt());
        savedRequest.setUpdatedAt(OffsetDateTime.now());

        when(requestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(certificationService.listForMentor(20L)).thenReturn(List.of());
        when(userRepository.save(any(User.class))).thenReturn(mentorUser);
        when(requestRepository.save(any(MentorVerificationRequest.class))).thenReturn(savedRequest);

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED", "adminNote": "Document could not be verified"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adminNote").value("Document could not be verified"));

        verify(emailNotificationService).sendVerificationRejected(mentorUser, "Document could not be verified");
        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(20L),
                org.mockito.ArgumentMatchers.eq("MENTOR_VERIFICATION"),
                anyString(), anyString(), anyLong());

        // Rejection must be recorded on the admin audit trail.
        verify(auditLogService).logAdmin(
                org.mockito.ArgumentMatchers.eq(adminUser),
                org.mockito.ArgumentMatchers.eq("MENTOR_VERIFICATION"),
                org.mockito.ArgumentMatchers.eq("MentorVerificationRequest"),
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.anyString());
    }

    private MentorCertificationDto certDto(MentorCertification cert) {
        MentorCertificationDto dto = new MentorCertificationDto();
        dto.setId(cert.getId());
        dto.setMentorId(cert.getMentor() != null ? cert.getMentor().getId() : null);
        dto.setCertificationName(cert.getCertificationName());
        dto.setIssuingOrganization(cert.getIssuingOrganization());
        dto.setCredentialId(cert.getCredentialId());
        dto.setCredentialUrl(cert.getCredentialUrl());
        dto.setIssueDate(cert.getIssueDate());
        dto.setExpirationDate(cert.getExpirationDate());
        dto.setDoesNotExpire(cert.isDoesNotExpire());
        dto.setSkillsCovered(cert.getSkillsCovered());
        dto.setDescription(cert.getDescription());
        dto.setCertificateImage(cert.getCertificateImage());
        dto.setCreatedAt(cert.getCreatedAt());
        dto.setUpdatedAt(cert.getUpdatedAt());
        return dto;
    }

    @Test
    void reject_requiresAdminRole() throws Exception {
        loginAs(mentorUser);

        mockMvc.perform(patch("/api/v1/verification/mentor/requests/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED", "adminNote": "No"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));

        verify(requestRepository, never()).findById(anyLong());
    }
}
