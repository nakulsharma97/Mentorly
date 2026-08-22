package com.skillswap.skill;

import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
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

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SkillController.class)
@AutoConfigureMockMvc(addFilters = false)
class SkillControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SkillRepository skillRepository;
    @MockitoBean
    private SkillRequestRepository skillRequestRepository;

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

    @BeforeEach
    void setUp() {
        adminUser = new User();
        adminUser.setId(1L);
        adminUser.setEmail("admin@mentorly.com");
        adminUser.setFullName("Admin User");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
        adminUser.setEnabled(true);

        learnerUser = new User();
        learnerUser.setId(10L);
        learnerUser.setEmail("learner@test.com");
        learnerUser.setUsername("testlearner");
        learnerUser.setFullName("Test Learner");
        learnerUser.setRole(UserRole.LEARNER);
        learnerUser.setEnabled(true);
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
    //  GET /api/v1/skills
    // ══════════════════════════════════════════════════════════════

    @Test
    void getAll_returnsAllSkills() throws Exception {
        Skill react = new Skill();
        react.setId(1L);
        react.setName("React");
        react.setCategory("Frontend");

        when(skillRepository.findAllByOrderByNameAsc()).thenReturn(List.of(react));

        mockMvc.perform(get("/api/v1/skills")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skills fetched"))
                .andExpect(jsonPath("$.data[0].name").value("React"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /api/v1/skills (admin only)
    // ══════════════════════════════════════════════════════════════

    @Test
    void create_allowsAdmin() throws Exception {
        loginAs(adminUser);

        Skill skill = new Skill();
        skill.setId(3L);
        skill.setName("Kubernetes");
        skill.setCategory("DevOps");

        when(skillRepository.existsByNameIgnoreCase("Kubernetes")).thenReturn(false);
        when(skillRepository.save(any(Skill.class))).thenReturn(skill);

        mockMvc.perform(post("/api/v1/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Kubernetes", "category": "DevOps"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill created"))
                .andExpect(jsonPath("$.data.name").value("Kubernetes"));
    }

    @Test
    void create_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(post("/api/v1/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Kubernetes", "category": "DevOps"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));

        verify(skillRepository, never()).save(any());
    }

    @Test
    void create_rejectsDuplicateName() throws Exception {
        loginAs(adminUser);

        when(skillRepository.existsByNameIgnoreCase("React")).thenReturn(true);

        mockMvc.perform(post("/api/v1/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "React", "category": "Frontend"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("A skill named \"React\" already exists"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /api/v1/skills/request (any authenticated user)
    // ══════════════════════════════════════════════════════════════

    @Test
    void submitRequest_createsPendingRequest_forAnyUser() throws Exception {
        loginAs(learnerUser);

        SkillRequest saved = new SkillRequest();
        saved.setId(7L);
        saved.setName("Kubernetes");
        saved.setCategory("DevOps");
        saved.setStatus(SkillRequestStatus.PENDING);
        saved.setRequestedBy(learnerUser);

        when(skillRepository.existsByNameIgnoreCase("Kubernetes")).thenReturn(false);
        when(skillRequestRepository
                .findFirstByNameIgnoreCaseAndStatusOrderByCreatedAtDesc("Kubernetes", SkillRequestStatus.PENDING))
                .thenReturn(Optional.empty());
        when(skillRequestRepository.save(any(SkillRequest.class))).thenReturn(saved);

        mockMvc.perform(post("/api/v1/skills/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Kubernetes", "category": "DevOps"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill request submitted for approval"))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.requestedByName").value("Test Learner"));
    }

    @Test
    void submitRequest_rejectsExistingSkill() throws Exception {
        loginAs(learnerUser);

        when(skillRepository.existsByNameIgnoreCase("React")).thenReturn(true);

        mockMvc.perform(post("/api/v1/skills/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "React", "category": "Frontend"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("A skill named \"React\" already exists"));
    }

    @Test
    void submitRequest_rejectsDuplicatePendingRequest() throws Exception {
        loginAs(learnerUser);

        SkillRequest existing = new SkillRequest();
        existing.setId(7L);
        existing.setName("Kubernetes");
        existing.setStatus(SkillRequestStatus.PENDING);

        when(skillRepository.existsByNameIgnoreCase("Kubernetes")).thenReturn(false);
        when(skillRequestRepository
                .findFirstByNameIgnoreCaseAndStatusOrderByCreatedAtDesc("Kubernetes", SkillRequestStatus.PENDING))
                .thenReturn(Optional.of(existing));

        mockMvc.perform(post("/api/v1/skills/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Kubernetes", "category": "DevOps"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("A pending request for \"Kubernetes\" already exists"));
    }

    @Test
    void submitRequest_requiresNameAndCategory() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(post("/api/v1/skills/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "category": ""}
                                """))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /api/v1/skills/my-requests
    // ══════════════════════════════════════════════════════════════

    @Test
    void myRequests_returnsOwnRequests() throws Exception {
        loginAs(learnerUser);

        SkillRequest pending = new SkillRequest();
        pending.setId(7L);
        pending.setName("Kubernetes");
        pending.setCategory("DevOps");
        pending.setStatus(SkillRequestStatus.PENDING);
        pending.setRequestedBy(learnerUser);

        when(skillRequestRepository.findByRequestedByIdOrderByCreatedAtDesc(10L, PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(pending)));

        mockMvc.perform(get("/api/v1/skills/my-requests")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill requests fetched"))
                .andExpect(jsonPath("$.data.content[0].name").value("Kubernetes"))
                .andExpect(jsonPath("$.data.content[0].status").value("PENDING"));
    }
}
