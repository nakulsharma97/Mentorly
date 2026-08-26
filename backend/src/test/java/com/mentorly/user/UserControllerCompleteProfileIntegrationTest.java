package com.mentorly.user;

import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.common.ProfileCompletionService;
import com.mentorly.config.EndpointRateLimitFilter;
import com.mentorly.config.JwtAuthenticationFilter;
import com.mentorly.config.MaintenanceModeFilter;
import com.mentorly.config.RequestTraceFilter;
import com.mentorly.notification.NotificationService;
import com.mentorly.verification.MentorVerificationService;
import com.mentorly.review.MentorReviewRepository;
import com.mentorly.session.SessionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the mandatory onboarding endpoint
 * {@code POST /api/v1/users/me/profile/complete} — including backend-only
 * validation, the {@code profileCompleted} flag, and the 403 enforcement on
 * protected endpoints for incomplete users (via the real guard bean).
 */
@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ProfileCompletionGuard.class, ProfileCompletionService.class})
class UserControllerCompleteProfileIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private MentorReviewRepository mentorReviewRepository;

    @MockitoBean
    private SessionRepository sessionRepository;

    @MockitoBean
    private NotificationService notificationService;

    @MockitoBean
    private MentorVerificationService mentorVerificationService;

    @MockitoBean
    private UserProjectService userProjectService;

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
    private com.mentorly.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.mentorly.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private User createUser(Long id, UserRole role, boolean profileCompleted) {
        User user = new User();
        user.setId(id);
        user.setEmail("user" + id + "@mentorly.test");
        user.setUsername("user" + id);
        user.setFullName("Test User");
        user.setRole(role);
        user.setProfileCompleted(profileCompleted);
        return user;
    }

    private void setSecurityContext(User user) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static final String COMPLETE_MENTOR_PAYLOAD = """
            {
              "fullName": "Jane Doe",
              "profileImageUrl": "https://example.com/jane.jpg",
              "headline": "React Mentor",
              "aboutMe": "I love teaching React.",
              "skills": "[{\\"name\\":\\"React\\",\\"level\\":\\"Advanced\\"}]",
              "yearsOfExperience": 6,
              "languages": "English",
              "education": "B.Tech Computer Science",
              "linkedinUrl": "https://linkedin.com/in/jane",
              "portfolioUrl": "https://jane.dev",
              "hourlyRate": 50,
              "timezone": "Asia/Kolkata",
              "availability": "Weekdays 6-9 PM",
              "country": "India",
              "state": "Delhi",
              "city": "New Delhi",
              "phoneNumber": "+91 98765 43210"
            }
            """;

    // ── POST /me/profile/complete ──────────────────────────

    @Test
    void completeProfile_rejectsMentorWithMissingRequiredFields() throws Exception {
        User mentor = createUser(10L, UserRole.MENTOR, false);
        setSecurityContext(mentor);

        mockMvc.perform(post("/api/v1/users/me/profile/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Jane Doe",
                                  "aboutMe": "Bio only"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value(org.hamcrest.Matchers.containsString("Missing required fields")));
    }

    @Test
    void completeProfile_mentorSuccessMarksProfileCompleted() throws Exception {
        User mentor = createUser(11L, UserRole.MENTOR, false);
        setSecurityContext(mentor);

        mockMvc.perform(post("/api/v1/users/me/profile/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COMPLETE_MENTOR_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Profile completed"))
                .andExpect(jsonPath("$.data.profileCompleted").value(true))
                .andExpect(jsonPath("$.data.headline").value("React Mentor"))
                .andExpect(jsonPath("$.data.country").value("India"))
                .andExpect(jsonPath("$.data.profileCompletionPercent").value(100));
    }

    @Test
    void completeProfile_rejectsLearnerMissingLearningGoals() throws Exception {
        User learner = createUser(12L, UserRole.LEARNER, false);
        setSecurityContext(learner);

        mockMvc.perform(post("/api/v1/users/me/profile/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "John Doe",
                                  "profileImageUrl": "https://example.com/john.jpg",
                                  "aboutMe": "Learning web dev",
                                  "skills": "[{\\"name\\":\\"React\\",\\"level\\":\\"Beginner\\"}]",
                                  "languages": "English",
                                  "timezone": "UTC",
                                  "country": "India",
                                  "state": "Maharashtra",
                                  "city": "Mumbai",
                                  "phoneNumber": "+91 90000 00000"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value(org.hamcrest.Matchers.containsString("learningGoals")));
    }

    @Test
    void completeProfile_learnerSuccessMarksProfileCompleted() throws Exception {
        User learner = createUser(13L, UserRole.LEARNER, false);
        setSecurityContext(learner);

        mockMvc.perform(post("/api/v1/users/me/profile/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "John Doe",
                                  "profileImageUrl": "https://example.com/john.jpg",
                                  "aboutMe": "Learning web dev",
                                  "skills": "[{\\"name\\":\\"React\\",\\"level\\":\\"Beginner\\"}]",
                                  "learningGoals": "Get a frontend job",
                                  "currentSkillLevel": "Beginner",
                                  "languages": "English",
                                  "timezone": "UTC",
                                  "country": "India",
                                  "state": "Maharashtra",
                                  "city": "Mumbai",
                                  "phoneNumber": "+91 90000 00000"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profileCompleted").value(true))
                .andExpect(jsonPath("$.data.currentSkillLevel").value("Beginner"));
    }

    @Test
    void completeProfile_rejectsAdmins() throws Exception {
        User admin = createUser(14L, UserRole.ADMIN, false);
        setSecurityContext(admin);

        mockMvc.perform(post("/api/v1/users/me/profile/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(COMPLETE_MENTOR_PAYLOAD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Admins do not use the profile completion flow."));
    }

    // ── Protected endpoint enforcement (403) ───────────────

    @Test
    void updateWallet_blockedForIncompleteUserWith403() throws Exception {
        User learner = createUser(20L, UserRole.LEARNER, false);
        setSecurityContext(learner);

        mockMvc.perform(put("/api/v1/users/me/wallet")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "walletAddress": "0xabc123" }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.data.error")
                        .value("Please complete your profile before connecting a wallet."));
    }

    @Test
    void updateWallet_allowedForCompletedUser() throws Exception {
        User learner = createUser(21L, UserRole.LEARNER, true);
        setSecurityContext(learner);
        // The guard passes; wallet save returns the (updated) user.
        when(userRepository.findById(21L)).thenReturn(Optional.of(learner));

        mockMvc.perform(put("/api/v1/users/me/wallet")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "walletAddress": "0xabc456" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.walletAddress").value("0xabc456"));
    }
}
