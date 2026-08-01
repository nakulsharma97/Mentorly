package com.skillswap.skill;

import com.skillswap.common.AuditLogRepository;
import com.skillswap.config.CsrfCookieFilter;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.verification.SkillVerificationTaskRepository;
import com.skillswap.watchlist.SkillWatchlistRepository;
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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SkillAdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class SkillAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SkillRepository skillRepository;
    @MockitoBean
    private SkillRequestRepository skillRequestRepository;
    @MockitoBean
    private SkillWatchlistRepository skillWatchlistRepository;
    @MockitoBean
    private SkillVerificationTaskRepository skillVerificationTaskRepository;
    @MockitoBean
    private NotificationService notificationService;
    @MockitoBean
    private AuditLogRepository auditLogRepository;

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

    private User adminUser;
    private User learnerUser;

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

    private Skill skill(Long id, String name, String category) {
        Skill skill = new Skill();
        skill.setId(id);
        skill.setName(name);
        skill.setCategory(category);
        return skill;
    }

    private SkillRequest request(Long id, String name, String category, SkillRequestStatus status) {
        SkillRequest request = new SkillRequest();
        request.setId(id);
        request.setName(name);
        request.setCategory(category);
        request.setStatus(status);
        request.setRequestedBy(learnerUser);
        request.setCreatedAt(OffsetDateTime.now().minusDays(1));
        return request;
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /api/v1/admin/skills
    // ══════════════════════════════════════════════════════════════

    @Test
    void listSkills_returnsAllWithCounts_forAdmin() throws Exception {
        loginAs(adminUser);

        when(skillRepository.findAllByOrderByNameAsc()).thenReturn(List.of(
                skill(1L, "React", "Frontend"),
                skill(2L, "Python", "Backend")));
        when(skillWatchlistRepository.countGroupedBySkillName())
                .thenReturn(List.<Object[]>of(new Object[]{"react", 3L}));
        when(skillVerificationTaskRepository.countGroupedBySkillName())
                .thenReturn(List.<Object[]>of(new Object[]{"python", 2L}));

        mockMvc.perform(get("/api/v1/admin/skills")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skills fetched"))
                .andExpect(jsonPath("$.data[0].name").value("React"))
                .andExpect(jsonPath("$.data[0].watchers").value(3))
                .andExpect(jsonPath("$.data[1].name").value("Python"))
                .andExpect(jsonPath("$.data[1].verificationTasks").value(2));
    }

    @Test
    void listSkills_filtersByQuery() throws Exception {
        loginAs(adminUser);

        when(skillRepository.findAllByOrderByNameAsc()).thenReturn(List.of(
                skill(1L, "React", "Frontend"),
                skill(2L, "Python", "Backend")));
        when(skillWatchlistRepository.countGroupedBySkillName()).thenReturn(List.of());
        when(skillVerificationTaskRepository.countGroupedBySkillName()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/skills?q=react")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("React"));
    }

    @Test
    void listSkills_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(get("/api/v1/admin/skills")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /api/v1/admin/skills/{id}
    // ══════════════════════════════════════════════════════════════

    @Test
    void editSkill_updatesNameAndCategory() throws Exception {
        loginAs(adminUser);

        Skill skill = skill(1L, "React", "Frontend");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(skill));
        when(skillRepository.findByNameIgnoreCase("ReactJS")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenReturn(skill);

        mockMvc.perform(patch("/api/v1/admin/skills/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "ReactJS", "category": "Frontend"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill updated"))
                .andExpect(jsonPath("$.data.name").value("ReactJS"));

        verify(skillWatchlistRepository).mergeSkillName("React", "ReactJS");
        verify(skillVerificationTaskRepository).mergeSkillName("React", "ReactJS");
        verify(auditLogRepository).save(any());
    }

    @Test
    void editSkill_rejectsDuplicateName() throws Exception {
        loginAs(adminUser);

        Skill skill = skill(1L, "React", "Frontend");
        Skill existing = skill(2L, "ReactJS", "Frontend");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(skill));
        when(skillRepository.findByNameIgnoreCase("ReactJS")).thenReturn(Optional.of(existing));

        mockMvc.perform(patch("/api/v1/admin/skills/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "ReactJS", "category": "Frontend"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("A skill named \"ReactJS\" already exists"));
    }

    @Test
    void editSkill_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(patch("/api/v1/admin/skills/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "React", "category": "Frontend"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));

        verify(skillRepository, never()).findById(anyLong());
    }

    // ══════════════════════════════════════════════════════════════
    //  DELETE /api/v1/admin/skills/{id}
    // ══════════════════════════════════════════════════════════════

    @Test
    void deleteSkill_removesSpamSkill_andWatchlistRefs() throws Exception {
        loginAs(adminUser);

        Skill skill = skill(1L, "SpamSkill", "Junk");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(skill));
        when(skillVerificationTaskRepository.countBySkillNameIgnoreCase("SpamSkill")).thenReturn(0L);

        mockMvc.perform(delete("/api/v1/admin/skills/1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill deleted"))
                .andExpect(jsonPath("$.data.deletedSkillId").value("1"));

        verify(skillWatchlistRepository).deleteBySkillNameIgnoreCase("SpamSkill");
        verify(skillRepository).delete(skill);
        verify(auditLogRepository).save(any());
    }

    @Test
    void deleteSkill_refusesWhenVerificationTasksDependOnIt() throws Exception {
        loginAs(adminUser);

        Skill skill = skill(1L, "Python", "Backend");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(skill));
        when(skillVerificationTaskRepository.countBySkillNameIgnoreCase("Python")).thenReturn(2L);

        mockMvc.perform(delete("/api/v1/admin/skills/1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Cannot delete \"Python\": 2 verification task(s) reference it. Merge the skill instead."));

        verify(skillRepository, never()).delete(any());
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /api/v1/admin/skills/{id}/merge
    // ══════════════════════════════════════════════════════════════

    @Test
    void mergeSkill_repointsReferences_andDeletesSource() throws Exception {
        loginAs(adminUser);

        Skill source = skill(1L, "ReactJS", "Frontend");
        Skill target = skill(2L, "React", "Frontend");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(source));
        when(skillRepository.findById(2L)).thenReturn(Optional.of(target));

        mockMvc.perform(post("/api/v1/admin/skills/1/merge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetSkillId": 2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skills merged"))
                .andExpect(jsonPath("$.data.name").value("React"));

        verify(skillWatchlistRepository).mergeSkillName("ReactJS", "React");
        verify(skillWatchlistRepository).deleteDuplicateMergedSkillName("ReactJS", "React");
        verify(skillVerificationTaskRepository).mergeSkillName("ReactJS", "React");
        verify(skillRepository).delete(source);
        verify(auditLogRepository).save(any());
    }

    @Test
    void mergeSkill_rejectsSelfMerge() throws Exception {
        loginAs(adminUser);

        Skill source = skill(1L, "ReactJS", "Frontend");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(source));

        mockMvc.perform(post("/api/v1/admin/skills/1/merge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetSkillId": 1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Cannot merge a skill into itself"));
    }

    @Test
    void mergeSkill_rejectsSameNameTarget() throws Exception {
        loginAs(adminUser);

        Skill source = skill(1L, "React", "Frontend");
        Skill target = skill(2L, "REACT", "Frontend");
        when(skillRepository.findById(1L)).thenReturn(Optional.of(source));
        when(skillRepository.findById(2L)).thenReturn(Optional.of(target));

        mockMvc.perform(post("/api/v1/admin/skills/1/merge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetSkillId": 2}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("The skills already share the same name"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /api/v1/admin/skills/skill-requests
    // ══════════════════════════════════════════════════════════════

    @Test
    void listSkillRequests_returnsPending_forAdmin() throws Exception {
        loginAs(adminUser);

        when(skillRequestRepository.findByStatusOrderByCreatedAtDesc(SkillRequestStatus.PENDING))
                .thenReturn(List.of(request(5L, "Kubernetes", "DevOps", SkillRequestStatus.PENDING)));

        mockMvc.perform(get("/api/v1/admin/skills/skill-requests")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill requests fetched"))
                .andExpect(jsonPath("$.data[0].name").value("Kubernetes"))
                .andExpect(jsonPath("$.data[0].status").value("PENDING"))
                .andExpect(jsonPath("$.data[0].requestedByName").value("Test Learner"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /api/v1/admin/skills/skill-requests/{id}
    // ══════════════════════════════════════════════════════════════

    @Test
    void approveSkillRequest_createsSkill_andNotifies() throws Exception {
        loginAs(adminUser);

        SkillRequest pending = request(5L, "Kubernetes", "DevOps", SkillRequestStatus.PENDING);
        when(skillRequestRepository.findById(5L)).thenReturn(Optional.of(pending));
        when(skillRepository.existsByNameIgnoreCase("Kubernetes")).thenReturn(false);
        when(skillRepository.save(any(Skill.class))).thenAnswer(inv -> inv.getArgument(0));
        when(skillRequestRepository.save(any(SkillRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/skills/skill-requests/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "APPROVED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Skill request updated"))
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        verify(skillRepository).save(any(Skill.class));
        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.eq("SKILL_REQUEST"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.isNull());
        verify(auditLogRepository).save(any());
    }

    @Test
    void approveSkillRequest_skipsDuplicateSkill() throws Exception {
        loginAs(adminUser);

        SkillRequest pending = request(5L, "Kubernetes", "DevOps", SkillRequestStatus.PENDING);
        when(skillRequestRepository.findById(5L)).thenReturn(Optional.of(pending));
        when(skillRepository.existsByNameIgnoreCase("Kubernetes")).thenReturn(true);
        when(skillRequestRepository.save(any(SkillRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/skills/skill-requests/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "APPROVED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        verify(skillRepository, never()).save(any(Skill.class));
    }

    @Test
    void rejectSkillRequest_recordsNote_andNotifies() throws Exception {
        loginAs(adminUser);

        SkillRequest pending = request(5L, "Kubernetes", "DevOps", SkillRequestStatus.PENDING);
        when(skillRequestRepository.findById(5L)).thenReturn(Optional.of(pending));
        when(skillRequestRepository.save(any(SkillRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/skills/skill-requests/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED", "adminNote": "Already exists as K8s"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adminNote").value("Already exists as K8s"));

        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.eq("SKILL_REQUEST"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.contains("not approved"),
                org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void decideSkillRequest_rejectsAlreadyDecided() throws Exception {
        loginAs(adminUser);

        SkillRequest decided = request(5L, "Kubernetes", "DevOps", SkillRequestStatus.APPROVED);
        when(skillRequestRepository.findById(5L)).thenReturn(Optional.of(decided));

        mockMvc.perform(patch("/api/v1/admin/skills/skill-requests/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Skill request is already APPROVED"));
    }

    @Test
    void decideSkillRequest_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(patch("/api/v1/admin/skills/skill-requests/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "APPROVED"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));

        verify(skillRequestRepository, never()).findById(anyLong());
    }
}
