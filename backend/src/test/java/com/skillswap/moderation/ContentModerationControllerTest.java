package com.skillswap.moderation;

import com.skillswap.common.AuditLogService;
import com.skillswap.config.CsrfCookieFilter;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.moderation.detection.ModerationScanner;
import com.skillswap.notification.NotificationService;
import com.skillswap.safety.ReportPriority;
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
import org.springframework.data.domain.PageImpl;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ContentModerationController.class)
@AutoConfigureMockMvc(addFilters = false)
class ContentModerationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ContentModerationService moderationService;
    @MockitoBean
    private UserRepository userRepository;
    @MockitoBean
    private ModerationScanner moderationScanner;
    @MockitoBean
    private AuditLogService auditLogService;
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

    private User adminUser;
    private User learnerUser;

    private FlaggedContent sampleItem() {
        FlaggedContent item = new FlaggedContent();
        item.setId(1L);
        item.setContentType(ContentType.CHAT_MESSAGE);
        item.setContentId(42L);
        item.setContentPreview("hello check this link http://spam.example");
        item.setOwner(learnerUser);
        item.setReporter(null);
        item.setDetectionSource(DetectionSource.SPAM_DETECTION);
        item.setReason("Multiple links — possible spam");
        item.setPriority(ReportPriority.HIGH);
        item.setStatus(ModerationStatus.PENDING_REVIEW);
        item.setAiConfidence(0.85);
        item.setCreatedAt(OffsetDateTime.now());
        item.setUpdatedAt(OffsetDateTime.now());
        return item;
    }

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
        learnerUser.setFullName("Test Learner");
        learnerUser.setRole(UserRole.LEARNER);
        learnerUser.setUsername("testlearner");
        learnerUser.setEnabled(true);
        learnerUser.setCreatedAt(OffsetDateTime.now().minusDays(30));
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

    @Test
    void list_returnsOk() throws Exception {
        loginAs(adminUser);

        when(moderationService.findQueue(any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(new PageImpl<>(List.of(sampleItem())));

        mockMvc.perform(get("/api/v1/admin/moderation")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Flagged content fetched"))
                .andExpect(jsonPath("$.data.content[0].id").value(1))
                .andExpect(jsonPath("$.data.content[0].contentType").value("CHAT_MESSAGE"))
                .andExpect(jsonPath("$.data.content[0].detectionSource").value("SPAM_DETECTION"))
                .andExpect(jsonPath("$.data.content[0].ownerName").value("Test Learner"))
                .andExpect(jsonPath("$.data.content[0].aiConfidence").value(0.85));
    }

    @Test
    void list_filtersByDetectionSourceAndReporter() throws Exception {
        loginAs(adminUser);

        when(moderationService.findQueue(any(), any(), any(), eq(DetectionSource.SPAM_DETECTION),
                any(), any(), any(), any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(new PageImpl<>(List.of(sampleItem())));

        mockMvc.perform(get("/api/v1/admin/moderation?detectionSource=SPAM_DETECTION&reporterId=10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(1));
    }

    @Test
    void events_returnsOk() throws Exception {
        loginAs(adminUser);

        ModerationEvent event = new ModerationEvent();
        event.setId(1L);
        event.setAction("FLAGGED");
        event.setActor(learnerUser);
        event.setFromStatus(null);
        event.setToStatus("PENDING_REVIEW");
        event.setNote("Flagged via SPAM_DETECTION");
        event.setCreatedAt(OffsetDateTime.now());

        when(moderationService.timeline(1L)).thenReturn(List.of(event));

        mockMvc.perform(get("/api/v1/admin/moderation/1/events")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Moderation timeline fetched"))
                .andExpect(jsonPath("$.data[0].action").value("FLAGGED"))
                .andExpect(jsonPath("$.data[0].toStatus").value("PENDING_REVIEW"));
    }

    @Test
    void detectionSources_returnsOk() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(get("/api/v1/admin/moderation/detection-sources")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Detection sources fetched"))
                .andExpect(jsonPath("$.data.length()").value(11));
    }

    @Test
    void list_filtersByStatusAndContentType() throws Exception {
        loginAs(adminUser);

        FlaggedContent item = sampleItem();
        when(moderationService.findQueue(any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(new PageImpl<>(List.of(item)));

        mockMvc.perform(get("/api/v1/admin/moderation?status=UNDER_INVESTIGATION&contentType=REVIEW")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(1));
    }

    @Test
    void list_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(get("/api/v1/admin/moderation")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    @Test
    void stats_returnsRealCounts() throws Exception {
        loginAs(adminUser);

        Map<String, Long> stats = Map.of(
                "total", 7L, "PENDING_REVIEW", 3L, "UNDER_INVESTIGATION", 2L,
                "APPROVED", 1L, "REMOVED", 1L, "priority_HIGH", 2L, "priority_CRITICAL", 1L,
                "decidedToday", 4L);
        when(moderationService.stats()).thenReturn(stats);

        mockMvc.perform(get("/api/v1/admin/moderation/stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Moderation stats fetched"))
                .andExpect(jsonPath("$.data.total").value(7))
                .andExpect(jsonPath("$.data.PENDING_REVIEW").value(3))
                .andExpect(jsonPath("$.data.priority_CRITICAL").value(1))
                .andExpect(jsonPath("$.data.decidedToday").value(4));
    }

    @Test
    void detail_returnsOk() throws Exception {
        loginAs(adminUser);

        when(moderationService.findById(1L)).thenReturn(sampleItem());

        mockMvc.perform(get("/api/v1/admin/moderation/1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Flagged content fetched"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.reason").value("Multiple links — possible spam"));
    }

    @Test
    void approve_returnsOk() throws Exception {
        loginAs(adminUser);

        FlaggedContent approved = sampleItem();
        approved.setStatus(ModerationStatus.APPROVED);
        when(moderationService.approve(any(), eq(1L), any())).thenReturn(approved);

        mockMvc.perform(post("/api/v1/admin/moderation/1/approve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": "Looks fine"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Content approved"))
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    @Test
    void remove_returnsOk() throws Exception {
        loginAs(adminUser);

        FlaggedContent removed = sampleItem();
        removed.setStatus(ModerationStatus.REMOVED);
        when(moderationService.remove(any(), eq(1L), any())).thenReturn(removed);

        mockMvc.perform(post("/api/v1/admin/moderation/1/remove")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": "Violates guidelines"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Content removed"))
                .andExpect(jsonPath("$.data.status").value("REMOVED"));
    }

    @Test
    void assign_returnsOk() throws Exception {
        loginAs(adminUser);

        FlaggedContent assigned = sampleItem();
        assigned.setStatus(ModerationStatus.UNDER_INVESTIGATION);
        when(moderationService.assign(any(), eq(1L), any())).thenReturn(assigned);

        mockMvc.perform(post("/api/v1/admin/moderation/1/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Item assigned"))
                .andExpect(jsonPath("$.data.status").value("UNDER_INVESTIGATION"));
    }

    @Test
    void setUserEnabled_suspends() throws Exception {
        loginAs(adminUser);

        FlaggedContent item = sampleItem();
        item.setStatus(ModerationStatus.UNDER_INVESTIGATION);
        when(moderationService.setOwnerEnabled(any(), eq(1L), anyBoolean())).thenReturn(item);

        mockMvc.perform(post("/api/v1/admin/moderation/1/user-enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User suspended"));
    }

    @Test
    void deletePermanently_returnsOk() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(delete("/api/v1/admin/moderation/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": "Spam"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Flagged content permanently deleted"))
                .andExpect(jsonPath("$.data.deletedItemId").value(1));

        verify(moderationService).deletePermanently(any(), eq(1L), any());
    }

    @Test
    void scan_returnsFlaggedItem_whenDetectorFires() throws Exception {
        loginAs(adminUser);

        FlaggedContent created = sampleItem();
        when(moderationService.scanAndFlag(any(), any(), any(), any(), any()))
                .thenReturn(created);

        mockMvc.perform(post("/api/v1/admin/moderation/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "contentType": "CHAT_MESSAGE",
                                  "contentId": 42,
                                  "contentPreview": "free vip cash prize winner click here",
                                  "ownerId": 10
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Content flagged"))
                .andExpect(jsonPath("$.data.id").value(1));
    }

    @Test
    void scan_returnsNoViolations_whenClean() throws Exception {
        loginAs(adminUser);

        when(moderationService.scanAndFlag(any(), any(), any(), any(), any()))
                .thenReturn(null);

        mockMvc.perform(post("/api/v1/admin/moderation/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "contentType": "SKILL",
                                  "contentPreview": "Learn Java from scratch",
                                  "ownerId": 10
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("No violations detected"));
    }

    @Test
    void warn_requiresNote() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(post("/api/v1/admin/moderation/1/warn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.errors.note").value("must not be blank"));
    }
}
