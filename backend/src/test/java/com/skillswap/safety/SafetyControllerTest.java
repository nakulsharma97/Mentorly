package com.skillswap.safety;

import com.skillswap.config.CsrfCookieFilter;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.skill.Skill;
import com.skillswap.skill.SkillRepository;
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

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SafetyController.class)
@AutoConfigureMockMvc(addFilters = false)
class SafetyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserBlockRepository blockRepository;
    @MockitoBean
    private UserReportRepository reportRepository;
    @MockitoBean
    private UserRepository userRepository;
    @MockitoBean
    private SessionRepository sessionRepository;
    @MockitoBean
    private SkillRepository skillRepository;
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
    private CsrfCookieFilter csrfCookieFilter;
    @MockitoBean
    private UserDetailsService userDetailsService;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;
    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private User learner;
    private User mentor;
    private User reporter;

    @BeforeEach
    void setUp() {
        reporter = new User();
        reporter.setId(1L);
        reporter.setEmail("reporter@test.com");
        reporter.setFullName("Reported By");
        reporter.setRole(UserRole.LEARNER);
        reporter.setEnabled(true);

        learner = new User();
        learner.setId(10L);
        learner.setEmail("learner@test.com");
        learner.setFullName("Test Learner");
        learner.setRole(UserRole.LEARNER);
        learner.setEnabled(true);

        mentor = new User();
        mentor.setId(20L);
        mentor.setEmail("mentor@test.com");
        mentor.setFullName("Test Mentor");
        mentor.setRole(UserRole.MENTOR);
        mentor.setEnabled(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(reporter, null, reporter.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void reportUser_reportsMentor() throws Exception {
        when(userRepository.findById(20L)).thenReturn(Optional.of(mentor));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reportedUserId": 20, "targetType": "MENTOR",
                                 "reason": "Inappropriate behavior", "details": "Details here"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report submitted"))
                .andExpect(jsonPath("$.data.targetType").value("MENTOR"))
                .andExpect(jsonPath("$.data.targetLabel").value("Test Mentor"))
                .andExpect(jsonPath("$.data.targetId").value(20));

        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(20L),
                org.mockito.ArgumentMatchers.eq("SAFETY_REPORT"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void reportUser_reportsLearner() throws Exception {
        when(userRepository.findById(10L)).thenReturn(Optional.of(learner));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reportedUserId": 10, "targetType": "LEARNER",
                                 "reason": "Harassment"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetType").value("LEARNER"))
                .andExpect(jsonPath("$.data.targetLabel").value("Test Learner"));
    }

    @Test
    void reportUser_reportsSession() throws Exception {
        SkillSession session = new SkillSession();
        session.setId(300L);
        session.setTitle("Java Masterclass");
        session.setMentor(mentor);
        when(sessionRepository.findById(300L)).thenReturn(Optional.of(session));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType": "SESSION", "targetId": 300,
                                 "reason": "Misleading description"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetType").value("SESSION"))
                .andExpect(jsonPath("$.data.targetLabel").value("Java Masterclass"));
    }

    @Test
    void reportUser_reportsSkill() throws Exception {
        Skill skill = new Skill();
        skill.setId(400L);
        skill.setName("Kubernetes");
        skill.setCategory("DevOps");
        when(skillRepository.findById(400L)).thenReturn(Optional.of(skill));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType": "SKILL", "targetId": 400,
                                 "reason": "Duplicate skill"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetType").value("SKILL"))
                .andExpect(jsonPath("$.data.targetLabel").value("Kubernetes"))
                .andExpect(jsonPath("$.data.targetId").value(400));
    }

    @Test
    void reportUser_rejectsSelfReport() throws Exception {
        when(userRepository.findById(1L)).thenReturn(Optional.of(reporter));

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reportedUserId": 1, "targetType": "LEARNER",
                                 "reason": "Test"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("You cannot report yourself"));
    }

    @Test
    void reportUser_rejectsInvalidTargetType() throws Exception {
        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType": "BANANA", "reason": "Test"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Invalid target type. Use MENTOR, LEARNER, SESSION, or SKILL."));
    }

    @Test
    void reportUser_rejectsMissingSession() throws Exception {
        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType": "SESSION", "targetId": 999,
                                 "reason": "No show"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Session not found"));
    }

    @Test
    void reportUser_rejectsMissingReason() throws Exception {
        when(userRepository.findById(20L)).thenReturn(Optional.of(mentor));

        mockMvc.perform(post("/api/v1/safety/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reportedUserId": 20, "targetType": "MENTOR", "reason": "   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("A reason is required"));
    }
}
