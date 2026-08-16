package com.skillswap.admin;

import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.chat.ChatMessage;
import com.skillswap.chat.ChatMessageRepository;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.messaging.DirectMessage;
import com.skillswap.messaging.DirectMessageRepository;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentService;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.safety.ReportPriority;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReport;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SessionStatus;
import com.skillswap.session.SessionType;
import com.skillswap.session.SkillSession;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequest;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import com.skillswap.mentorcertification.MentorCertificationService;
import com.skillswap.watchlist.SkillWatchlistRepository;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletService;
import com.skillswap.wallet.WalletTransactionType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserRepository userRepository;
    @MockitoBean
    private UserReportRepository reportRepository;
    @MockitoBean
    private MentorVerificationRequestRepository mentorVerificationRepository;
    @MockitoBean
    private MentorCertificationService mentorCertificationService;
    @MockitoBean
    private WalletService walletService;
    @MockitoBean
    private BookingRepository bookingRepository;
    @MockitoBean
    private ChatMessageRepository chatMessageRepository;
    @MockitoBean
    private DirectConversationRepository directConversationRepository;
    @MockitoBean
    private DirectMessageRepository directMessageRepository;
    @MockitoBean
    private PaymentRepository paymentRepository;
    @MockitoBean
    private PaymentService paymentService;
    @MockitoBean
    private AuditLogRepository auditLogRepository;
    @MockitoBean
    private com.skillswap.common.AuditLogService auditLogService;
    @MockitoBean
    private SessionRepository sessionRepository;
    @MockitoBean
    private NotificationService notificationService;
    @MockitoBean
    private EmailNotificationService emailNotificationService;
    @MockitoBean
    private AdminSettingRepository adminSettingRepository;
    @MockitoBean
    private AdminNotifPreferenceRepository adminNotifPreferenceRepository;

    @MockitoBean
    private MentorReviewRepository mentorReviewRepository;

    @MockitoBean
    private SkillWatchlistRepository skillWatchlistRepository;

    @MockitoBean
    private com.skillswap.moderation.FlaggedContentRepository flaggedContentRepository;

    @MockitoBean
    private com.skillswap.skill.SkillRepository skillRepository;

    @MockitoBean
    private com.skillswap.notification.AppNotificationRepository appNotificationRepository;

    @MockitoBean
    private com.skillswap.monitoring.SystemHealthService systemHealthService;

    @MockitoBean
    private CertMigrationService certMigrationService;

    @MockitoBean
    private AdminService adminService;

    @MockitoBean
    private com.skillswap.user.UserProjectService userProjectService;

    @MockitoBean
    private AdminNotificationService adminNotificationService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;
    @MockitoBean
    private RequestTraceFilter requestTraceFilter;

    @MockitoBean
    private MaintenanceModeFilter maintenanceModeFilter;


    @MockitoBean
    private UserDetailsService userDetailsService;    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private User adminUser;
    private User learnerUser;
    private User mentorUser;

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

        mentorUser = new User();
        mentorUser.setId(20L);
        mentorUser.setEmail("mentor@test.com");
        mentorUser.setFullName("Test Mentor");
        mentorUser.setRole(UserRole.MENTOR);
        mentorUser.setUsername("testmentor");
        mentorUser.setMentorVerified(true);
        mentorUser.setEnabled(true);
        mentorUser.setCreatedAt(OffsetDateTime.now().minusDays(60));
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
    //  GET /summary
    // ══════════════════════════════════════════════════════════════

    @Test
    void summary_returnsOk_forAdmin() throws Exception {
        loginAs(adminUser);

        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countByRole(UserRole.LEARNER)).thenReturn(2L);
        when(userRepository.countByRole(UserRole.MENTOR)).thenReturn(1L);
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(1L);
        when(reportRepository.countByStatus(ReportStatus.OPEN)).thenReturn(1L);
        when(mentorVerificationRepository.countByStatus(MentorVerificationRequestStatus.PENDING))
                .thenReturn(1L);

        mockMvc.perform(get("/api/v1/admin/summary")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Admin summary fetched"))
                .andExpect(jsonPath("$.data.totalUsers").value(100))
                .andExpect(jsonPath("$.data.learners").value(2))
                .andExpect(jsonPath("$.data.mentors").value(1))
                .andExpect(jsonPath("$.data.admins").value(1))
                .andExpect(jsonPath("$.data.openReports").value(1))
                .andExpect(jsonPath("$.data.pendingMentorVerifications").value(1));
    }

    @Test
    void summary_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(get("/api/v1/admin/summary")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /dashboard
    // ══════════════════════════════════════════════════════════════

    @Test
    void dashboard_returnsOk_withDefaultMonths() throws Exception {
        loginAs(adminUser);

        when(userRepository.count()).thenReturn(2L);
        when(userRepository.countByRole(UserRole.MENTOR)).thenReturn(1L);
        when(userRepository.countByRole(UserRole.LEARNER)).thenReturn(1L);
        when(sessionRepository.count()).thenReturn(12L);
        when(bookingRepository.count()).thenReturn(0L);
        when(bookingRepository.countByBookingStatus(BookingStatus.COMPLETED)).thenReturn(0L);
        when(userRepository.countByLastActiveAtAfter(any())).thenReturn(2L);
        when(userRepository.countByCreatedAtAfter(any())).thenReturn(0L);
        when(paymentRepository.computeMonthlySignupTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlyRevenueTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlySessionTrend(any())).thenReturn(List.of());
        when(bookingRepository.computeMonthlyBookingTrend(any())).thenReturn(List.of());
        when(bookingRepository.countTopMentorBookings()).thenReturn(List.of());
        when(userRepository.findSkillsByRole(UserRole.MENTOR)).thenReturn(List.of());
        when(skillWatchlistRepository.countGroupedBySkillName()).thenReturn(List.of());
        stubDashboardAggregates();

        mockMvc.perform(get("/api/v1/admin/dashboard")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Dashboard data fetched"))
                .andExpect(jsonPath("$.data.signupTrend").isArray())
                .andExpect(jsonPath("$.data.revenueTrend").isArray())
                .andExpect(jsonPath("$.data.sessionTrend").isArray())
                .andExpect(jsonPath("$.data.completionTrend").isArray())
                .andExpect(jsonPath("$.data.reportsTrend").isArray())
                .andExpect(jsonPath("$.data.flaggedTrend").isArray())
                .andExpect(jsonPath("$.data.dailySignups").isArray())
                .andExpect(jsonPath("$.data.dailyActive").isArray())
                .andExpect(jsonPath("$.data.sessionStatusDistribution").isArray())
                .andExpect(jsonPath("$.data.verificationDistribution").isArray())
                .andExpect(jsonPath("$.data.topLearners").isArray())
                .andExpect(jsonPath("$.data.recentActivity").isArray())
                .andExpect(jsonPath("$.data.platformHealth").exists())
                .andExpect(jsonPath("$.data.topSkills").isArray())
                .andExpect(jsonPath("$.data.topMentors").isArray())
                .andExpect(jsonPath("$.data.health").exists())
                .andExpect(jsonPath("$.data.health.totalUsers").value(2))
                .andExpect(jsonPath("$.data.health.totalSessions").value(12))
                .andExpect(jsonPath("$.data.health.totalPayments").value(0));
    }

    /** Shared stubs for every aggregate the dashboard now computes. */
    private void stubDashboardAggregates() {
        when(userRepository.countByMentorVerifiedTrue()).thenReturn(0L);
        when(skillRepository.count()).thenReturn(0L);
        when(sessionRepository.countByStatus(any())).thenReturn(0L);
        when(bookingRepository.countByBookingStatus(any())).thenReturn(0L);
        when(directConversationRepository.count()).thenReturn(0L);
        when(chatMessageRepository.countDistinctBookingIds()).thenReturn(0L);
        when(reportRepository.countByStatus(any())).thenReturn(0L);
        when(flaggedContentRepository.countByDeletedAtIsNull()).thenReturn(0L);
        when(paymentRepository.count()).thenReturn(0L);
        when(paymentRepository.computeRevenueSince(any())).thenReturn(java.math.BigDecimal.ZERO);
        when(reportRepository.computeMonthlyTrend(any())).thenReturn(List.of());
        when(flaggedContentRepository.computeMonthlyTrend(any())).thenReturn(List.of());
        when(userRepository.countDailySignups(any())).thenReturn(List.of());
        when(userRepository.countDailyActive(any())).thenReturn(List.of());
        when(sessionRepository.countGroupedByStatus()).thenReturn(List.of());
        when(mentorVerificationRepository.countGroupedByStatus()).thenReturn(List.of());
        when(bookingRepository.countTopLearnerBookings()).thenReturn(List.of());
        when(userRepository.findTop5ByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(bookingRepository.findTop5ByBookingStatusOrderByCreatedAtDesc(any())).thenReturn(List.of());
        when(paymentRepository.findTop5ByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(reportRepository.findTop5ByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(flaggedContentRepository.findTop5ByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(auditLogRepository.findTop10ByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(auditLogRepository.countByActionContainingIgnoreCaseAndCreatedAtAfter(any(), any())).thenReturn(0L);
        when(appNotificationRepository.countByCreatedAtAfter(any())).thenReturn(0L);
    }

    @Test
    void dashboard_returnsOk_withCustomMonths() throws Exception {
        loginAs(adminUser);

        when(userRepository.count()).thenReturn(0L);
        when(userRepository.countByRole(UserRole.MENTOR)).thenReturn(0L);
        when(userRepository.countByRole(UserRole.LEARNER)).thenReturn(0L);
        when(bookingRepository.count()).thenReturn(0L);
        when(bookingRepository.countByBookingStatus(BookingStatus.COMPLETED)).thenReturn(0L);
        when(userRepository.countByLastActiveAtAfter(any())).thenReturn(0L);
        when(userRepository.countByCreatedAtAfter(any())).thenReturn(0L);
        when(paymentRepository.computeMonthlySignupTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlyRevenueTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlySessionTrend(any())).thenReturn(List.of());
        when(bookingRepository.computeMonthlyBookingTrend(any())).thenReturn(List.of());
        when(bookingRepository.countTopMentorBookings()).thenReturn(List.of());
        when(userRepository.findSkillsByRole(UserRole.MENTOR)).thenReturn(List.of());
        when(skillWatchlistRepository.countGroupedBySkillName()).thenReturn(List.of());
        stubDashboardAggregates();

        mockMvc.perform(get("/api/v1/admin/dashboard?months=3")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.signupTrend.length()").value(3))
                .andExpect(jsonPath("$.data.completionTrend.length()").value(3))
                .andExpect(jsonPath("$.data.topSkills.length()").value(0))
                .andExpect(jsonPath("$.data.topMentors.length()").value(0));
    }

    @Test
    void dashboard_clampsMonthsToMax24() throws Exception {
        loginAs(adminUser);

        when(userRepository.count()).thenReturn(0L);
        when(userRepository.countByRole(UserRole.MENTOR)).thenReturn(0L);
        when(userRepository.countByRole(UserRole.LEARNER)).thenReturn(0L);
        when(bookingRepository.count()).thenReturn(0L);
        when(bookingRepository.countByBookingStatus(BookingStatus.COMPLETED)).thenReturn(0L);
        when(userRepository.countByLastActiveAtAfter(any())).thenReturn(0L);
        when(userRepository.countByCreatedAtAfter(any())).thenReturn(0L);
        when(paymentRepository.computeMonthlySignupTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlyRevenueTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlySessionTrend(any())).thenReturn(List.of());
        when(bookingRepository.computeMonthlyBookingTrend(any())).thenReturn(List.of());
        when(bookingRepository.countTopMentorBookings()).thenReturn(List.of());
        when(userRepository.findSkillsByRole(UserRole.MENTOR)).thenReturn(List.of());
        when(skillWatchlistRepository.countGroupedBySkillName()).thenReturn(List.of());
        stubDashboardAggregates();

        mockMvc.perform(get("/api/v1/admin/dashboard?months=99")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.signupTrend.length()").value(24));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /health
    // ══════════════════════════════════════════════════════════════

    @Test
    void health_returnsOk_forAdmin() throws Exception {
        loginAs(adminUser);

        com.skillswap.monitoring.MonitoringDtos.AdminHealthDto dto =
                new com.skillswap.monitoring.MonitoringDtos.AdminHealthDto(
                        "healthy", "HEALTHY", "1d 2h", "150MB / 512MB", 29.3,
                        3L, 50L, 200L, 0L, "2026-01-01T00:00:00Z",
                        null, null, null, null, null, null, null, null, null, null, null, 0L);
        when(systemHealthService.getPlatformHealth()).thenReturn(dto);

        mockMvc.perform(get("/api/v1/admin/health")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Health data fetched"))
                .andExpect(jsonPath("$.data.status").value("healthy"))
                .andExpect(jsonPath("$.data.totalUsers").value(50))
                .andExpect(jsonPath("$.data.totalBookings").value(200))
                .andExpect(jsonPath("$.data.pendingReports").value(0));
    }

    @Test
    void healthLogs_returnsLogs_forAdmin() throws Exception {
        loginAs(adminUser);

        when(systemHealthService.recentLogs(eq("ERROR"), eq("login"), anyInt()))
                .thenReturn(List.of(new com.skillswap.monitoring.LogBufferService.LogEntry(
                        "2026-01-01T00:00:00Z", "AuthService", "ERROR", "login failed")));
        when(systemHealthService.countLogs(eq("ERROR"), eq("login"))).thenReturn(1L);

        mockMvc.perform(get("/api/v1/admin/health/logs")
                        .param("level", "ERROR")
                        .param("q", "login")
                        .param("page", "0")
                        .param("size", "20")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logs fetched"))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void health_rejectsNonAdmin() throws Exception {
        loginAs(mentorUser);

        mockMvc.perform(get("/api/v1/admin/health")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /sessions/{id}/details
    // ══════════════════════════════════════════════════════════════

    @Test
    void sessionDetails_returnsOk() throws Exception {
        loginAs(adminUser);

        SkillSession session = new SkillSession();
        session.setId(100L);
        session.setTitle("Java Masterclass");
        session.setStatus(SessionStatus.PENDING);
        session.setPriceAmount(new BigDecimal("50.00"));
        session.setMentor(mentorUser);
        session.setCreatedAt(OffsetDateTime.now());

        Booking booking = new Booking();
        booking.setId(1L);
        booking.setSession(session);
        booking.setLearner(learnerUser);
        booking.setBookingStatus(BookingStatus.COMPLETED);

        // Payment with amount
        Payment payment = Payment.builder()
                .id(1L).amount(new BigDecimal("50.00")).build();
        booking.setPayment(payment);

        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        when(bookingRepository.findBySessionId(100L)).thenReturn(List.of(booking));

        mockMvc.perform(get("/api/v1/admin/sessions/100/details")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Session details fetched"))
                .andExpect(jsonPath("$.data.sessionId").value(100))
                .andExpect(jsonPath("$.data.title").value("Java Masterclass"))
                .andExpect(jsonPath("$.data.totalRevenue").isNumber())
                .andExpect(jsonPath("$.data.totalBookings").value(1));
    }

    @Test
    void sessionDetails_returnsNotFound() throws Exception {
        loginAs(adminUser);

        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/admin/sessions/999/details")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Session not found"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /users/bulk/enable
    // ══════════════════════════════════════════════════════════════

    @Test
    void bulkEnableUsers_returnsOk() throws Exception {
        loginAs(adminUser);

        User target = new User();
        target.setId(30L);
        target.setEnabled(false);

        when(userRepository.findById(30L)).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenReturn(target);
        when(adminService.bulkEnableUsers(anyList())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/users/bulk/enable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids": [30]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Bulk enable complete"))
                .andExpect(jsonPath("$.data.updatedCount").value(1));
    }

    @Test
    void bulkEnableUsers_skipsSelf() throws Exception {
        loginAs(adminUser);

        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        mockMvc.perform(post("/api/v1/admin/users/bulk/enable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids": [1]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.updatedCount").value(0));
    }

    @Test
    void bulkEnableUsers_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(post("/api/v1/admin/users/bulk/enable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids": [30]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /users/bulk/disable
    // ══════════════════════════════════════════════════════════════

    @Test
    void bulkDisableUsers_returnsOk() throws Exception {
        loginAs(adminUser);

        User target = new User();
        target.setId(30L);
        target.setEnabled(true);

        when(userRepository.findById(30L)).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenReturn(target);
        when(adminService.bulkDisableUsers(anyList())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/users/bulk/disable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids": [30]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Bulk disable complete"))
                .andExpect(jsonPath("$.data.updatedCount").value(1));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /users/bulk/role
    // ══════════════════════════════════════════════════════════════

    @Test
    void bulkUpdateRole_returnsOk() throws Exception {
        loginAs(adminUser);

        User target = new User();
        target.setId(30L);
        target.setRole(UserRole.LEARNER);

        when(userRepository.findById(30L)).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenReturn(target);
        when(adminService.bulkUpdateRole(anyList(), eq(UserRole.MENTOR))).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/users/bulk/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids": [30], "role": "MENTOR"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Bulk role update complete"))
                .andExpect(jsonPath("$.data.updatedCount").value(1));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /notification-preferences
    // ══════════════════════════════════════════════════════════════

    @Test
    void getNotificationPreferences_returnsOk() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(get("/api/v1/admin/notification-preferences")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Preferences fetched"))
                .andExpect(jsonPath("$.data.new_user_signups").isBoolean())
                .andExpect(jsonPath("$.data.reports_filed").isBoolean())
                .andExpect(jsonPath("$.data.failed_payments").isBoolean());
    }

    // ══════════════════════════════════════════════════════════════
    //  PUT /notification-preferences
    // ══════════════════════════════════════════════════════════════

    @Test
    void updateNotificationPreferences_returnsOk() throws Exception {
        loginAs(adminUser);

        AdminNotifPreference reportsPref = new AdminNotifPreference();
        reportsPref.setId(1L);
        reportsPref.setPrefKey("reports_filed");
        reportsPref.setPrefValue(false);

        when(adminNotifPreferenceRepository.findByPrefKey("reports_filed"))
                .thenReturn(Optional.empty());
        when(adminNotifPreferenceRepository.save(any(AdminNotifPreference.class)))
                .thenReturn(reportsPref);
        when(adminNotifPreferenceRepository.findAll())
                .thenReturn(List.of(reportsPref));

        mockMvc.perform(put("/api/v1/admin/notification-preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reports_filed": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Preferences updated"))
                .andExpect(jsonPath("$.data.reports_filed").value(false));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /users
    // ══════════════════════════════════════════════════════════════

    @Test
    void listUsers_returnsOk() throws Exception {
        loginAs(adminUser);

        Page<User> userPage = new PageImpl<>(List.of(learnerUser, mentorUser));
        when(userRepository.findByFilters(any(), any(), any(Pageable.class)))
                .thenReturn(userPage);
        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("100.00"), "CREDITS"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Users fetched"))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    void listUsers_filtersByRole() throws Exception {
        loginAs(adminUser);

        Page<User> userPage = new PageImpl<>(List.of(mentorUser));
        when(userRepository.findByFilters(eq(UserRole.MENTOR), any(), any(Pageable.class)))
                .thenReturn(userPage);
        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("0"), "CREDITS"));

        mockMvc.perform(get("/api/v1/admin/users?role=MENTOR")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].role").value("MENTOR"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /users/{id}/enabled
    // ══════════════════════════════════════════════════════════════

    @Test
    void setUserEnabled_returnsOk() throws Exception {
        loginAs(adminUser);

        User target = new User();
        target.setId(30L);
        target.setEnabled(false);

        when(userRepository.findById(30L)).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenReturn(target);

        mockMvc.perform(patch("/api/v1/admin/users/30/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User status updated"))
                // Security: the raw User entity must never serialize credential data.
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordResetToken").doesNotExist());

        // Enabling a user must be recorded in the audit log (USER_ENABLE action).
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void listUsers_doesNotExposeCredentialFields() throws Exception {
        loginAs(adminUser);

        Page<User> userPage = new PageImpl<>(List.of(mentorUser));
        when(userRepository.findByFilters(any(), any(), any(Pageable.class)))
                .thenReturn(userPage);
        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("0"), "CREDITS"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].email").value("mentor@test.com"))
                .andExpect(jsonPath("$.data.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].passwordResetToken").doesNotExist());
    }

    @Test
    void listUsers_returnsGenericMessage_onUnhandledError() throws Exception {
        loginAs(adminUser);

        when(userRepository.findByFilters(any(), any(), any(Pageable.class)))
                .thenThrow(new RuntimeException("com.mysql.cj.jdbc: Internal SQL detail that must not leak"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.data.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.data.error").value("Unexpected server error"))
                // The raw exception message (internal details) must not leak.
                .andExpect(jsonPath("$.data.error").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("mysql"))));
    }

    @Test
    void setUserEnabled_rejectsSelfDisable() throws Exception {
        loginAs(adminUser);

        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        mockMvc.perform(patch("/api/v1/admin/users/1/enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": false}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Admins cannot disable their own account"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /users/{id}/role
    // ══════════════════════════════════════════════════════════════

    @Test
    void updateUserRole_returnsOk() throws Exception {
        loginAs(adminUser);

        User target = new User();
        target.setId(30L);
        target.setRole(UserRole.LEARNER);
        target.setMentorVerified(false);

        when(userRepository.findById(30L)).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenReturn(target);

        mockMvc.perform(patch("/api/v1/admin/users/30/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role": "MENTOR"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User role updated"));
    }

    @Test
    void updateUserRole_rejectsSelfRoleChange() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(patch("/api/v1/admin/users/1/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role": "LEARNER"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Admins cannot change their own role"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /users/{id}/wallet-ledger
    // ══════════════════════════════════════════════════════════════

    @Test
    void createWalletLedgerEntry_returnsOk() throws Exception {
        loginAs(adminUser);

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(77L);
        entry.setType(WalletTransactionType.CREDIT);
        entry.setAmount(new BigDecimal("50.00"));
        entry.setBalanceAfter(new BigDecimal("150.00"));

        when(walletService.addEntryForUser(anyLong(), any()))
                .thenReturn(entry);

        mockMvc.perform(post("/api/v1/admin/users/10/wallet-ledger")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "type": "CREDIT",
                                    "amount": 50.00,
                                    "currency": "CREDITS",
                                    "description": "Admin bonus",
                                    "referenceType": "ADMIN",
                                    "referenceId": null
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Wallet ledger entry created"))
                .andExpect(jsonPath("$.data.id").value(77));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /users/{id}/wallet
    // ══════════════════════════════════════════════════════════════

    @Test
    void getUserWallet_returnsOk() throws Exception {
        loginAs(adminUser);

        when(userRepository.findById(10L)).thenReturn(Optional.of(learnerUser));
        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("250.00"), "CREDITS"));
        when(walletService.history(any(User.class))).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/users/10/wallet")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Wallet fetched"))
                .andExpect(jsonPath("$.data.userId").value(10))
                .andExpect(jsonPath("$.data.balance").value(250.00));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /sessions
    // ══════════════════════════════════════════════════════════════

    @Test
    void listSessions_returnsOk() throws Exception {
        loginAs(adminUser);

        SkillSession session = new SkillSession();
        session.setId(100L);
        session.setTitle("Test Session");
        session.setStatus(SessionStatus.PENDING);
        session.setMentor(mentorUser);
        session.setPriceAmount(new BigDecimal("25.00"));
        session.setSessionType(SessionType.PUBLIC);
        session.setStartTime(OffsetDateTime.now().plusDays(1));
        session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(2));
        session.setMaxParticipants(5);
        session.setCreatedAt(OffsetDateTime.now());

        Page<SkillSession> sessionPage = new PageImpl<>(List.of(session));
        when(sessionRepository.findByFilters(any(), any(), any(Pageable.class)))
                .thenReturn(sessionPage);

        mockMvc.perform(get("/api/v1/admin/sessions")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Sessions fetched"))
                .andExpect(jsonPath("$.data.content[0].id").value(100))
                .andExpect(jsonPath("$.data.content[0].title").value("Test Session"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /sessions/{id}/status
    // ══════════════════════════════════════════════════════════════

    @Test
    void updateSessionStatus_returnsOk() throws Exception {
        loginAs(adminUser);

        SkillSession session = new SkillSession();
        session.setId(100L);
        session.setStatus(SessionStatus.PENDING);
        session.setMeetingLink("https://meet.google.com/abc");

        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        when(sessionRepository.save(any(SkillSession.class))).thenReturn(session);

        mockMvc.perform(patch("/api/v1/admin/sessions/100/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "CANCELLED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Session status updated"));
    }

    // ══════════════════════════════════════════════════════════════
    //  DELETE /sessions/{id}
    // ══════════════════════════════════════════════════════════════

    @Test
    void deleteSession_returnsOk_forAdmin() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(delete("/api/v1/admin/sessions/100")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Session deleted"))
                .andExpect(jsonPath("$.data.deletedSessionId").value(100));

        verify(adminService).deleteSession(adminUser, 100L);
    }

    @Test
    void deleteSession_returnsNotFound() throws Exception {
        loginAs(adminUser);

        doThrow(new IllegalArgumentException("Session not found"))
                .when(adminService).deleteSession(any(User.class), eq(999L));

        mockMvc.perform(delete("/api/v1/admin/sessions/999")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Session not found"));
    }

    @Test
    void deleteSession_rejectsNonAdmin() throws Exception {
        loginAs(mentorUser);

        mockMvc.perform(delete("/api/v1/admin/sessions/100")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));

        verify(adminService, never()).deleteSession(any(), anyLong());
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /payments
    // ══════════════════════════════════════════════════════════════

    @Test
    void listPayments_returnsOk() throws Exception {
        loginAs(adminUser);

        Payment payment = Payment.builder()
                .id(1L)
                .orderId("ORDER_001")
                .learnerId(10L)
                .mentorId(20L)
                .sessionId(100L)
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .status(PaymentStatus.RELEASED)
                .gateway("razorpay")
                .createdAt(OffsetDateTime.now())
                .build();

        when(paymentRepository.computeAggregates()).thenReturn(List.of());
        when(paymentRepository.findByFilters(any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(payment)));

        mockMvc.perform(get("/api/v1/admin/payments")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Payments fetched"))
                .andExpect(jsonPath("$.data.totalRevenue").isNumber())
                .andExpect(jsonPath("$.data.platformFees").isNumber())
                .andExpect(jsonPath("$.data.escrowedCount").isNumber())
                .andExpect(jsonPath("$.data.payments[0].id").value(1));
    }

    @Test
    void listPayments_filtersByStatus() throws Exception {
        loginAs(adminUser);

        Payment payment = Payment.builder()
                .id(2L)
                .orderId("ORDER_002")
                .learnerId(10L)
                .mentorId(20L)
                .sessionId(100L)
                .amount(new BigDecimal("50.00"))
                .currency("INR")
                .status(PaymentStatus.ESCROWED)
                .gateway("stripe")
                .createdAt(OffsetDateTime.now())
                .build();

        when(paymentRepository.computeAggregates()).thenReturn(List.of());
        when(paymentRepository.findByFilters(any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(payment)));

        mockMvc.perform(get("/api/v1/admin/payments?status=ESCROWED")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.payments[0].status").value("ESCROWED"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /payments/{id}/refund
    // ══════════════════════════════════════════════════════════════

    @Test
    void refundPayment_returnsOk() throws Exception {
        loginAs(adminUser);

        Payment payment = Payment.builder()
                .id(1L)
                .orderId("ORDER_001")
                .learnerId(10L)
                .mentorId(20L)
                .sessionId(100L)
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .status(PaymentStatus.ESCROWED)
                .gateway("razorpay")
                .build();

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));
        when(walletService.addEntryForUser(anyLong(), any()))
                .thenReturn(new WalletLedgerEntry());
        when(paymentRepository.save(any(Payment.class))).thenReturn(payment);

        mockMvc.perform(post("/api/v1/admin/payments/1/refund")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason": "Admin courtesy refund"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Payment refunded by admin"));
    }

    @Test
    void refundPayment_rejectsNonEscrowed() throws Exception {
        loginAs(adminUser);

        Payment payment = Payment.builder()
                .id(2L)
                .orderId("ORDER_002")
                .learnerId(10L)
                .mentorId(20L)
                .sessionId(100L)
                .amount(new BigDecimal("50.00"))
                .currency("INR")
                .status(PaymentStatus.RELEASED)
                .gateway("stripe")
                .build();

        when(paymentRepository.findById(2L)).thenReturn(Optional.of(payment));
        when(adminService.refundPayment(any(User.class), eq(2L), any())).thenThrow(
                new IllegalArgumentException("Only escrowed payments can be refunded. Current status: RELEASED"));

        mockMvc.perform(post("/api/v1/admin/payments/2/refund")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Only escrowed payments can be refunded. Current status: RELEASED"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /notifications/broadcast
    // ══════════════════════════════════════════════════════════════

    @Test
    void broadcastNotification_returnsOk() throws Exception {
        loginAs(adminUser);

        when(userRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(learnerUser, mentorUser)));
        when(adminService.broadcastNotification(anyString(), anyString(), anyString(), eq("ANNOUNCEMENT"))).thenReturn(2);

        mockMvc.perform(post("/api/v1/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Maintenance", "message": "Server down tonight", "targetRole": ""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast sent"))
                .andExpect(jsonPath("$.data.sentCount").value(2))
                .andExpect(jsonPath("$.data.type").value("ANNOUNCEMENT"));
    }

    @Test
    void broadcastNotification_passesTypeThrough() throws Exception {
        loginAs(adminUser);

        when(userRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(learnerUser, mentorUser)));
        when(adminService.broadcastNotification("Platform update", "v2.0 is live", null, "PLATFORM_UPDATE"))
                .thenReturn(2);

        mockMvc.perform(post("/api/v1/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Platform update", "message": "v2.0 is live", "type": "PLATFORM_UPDATE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast sent"))
                .andExpect(jsonPath("$.data.type").value("PLATFORM_UPDATE"));

        verify(adminService).broadcastNotification("Platform update", "v2.0 is live", null, "PLATFORM_UPDATE");
    }

    @Test
    void broadcastNotification_rejectsInvalidType() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(post("/api/v1/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Test", "message": "Hello", "type": "SPAM"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Type must be ANNOUNCEMENT, MAINTENANCE, or PLATFORM_UPDATE"));
    }

    @Test
    void broadcastNotification_rejectsMissingTitle() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(post("/api/v1/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "", "message": "Test", "targetRole": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.errors.title").value("must not be blank"));
    }

    // ══════════════════════════════════════════════════════════════
    //  Notification & Broadcast Center
    // ══════════════════════════════════════════════════════════════

    @Test
    void notificationDashboard_returnsOk() throws Exception {
        loginAs(adminUser);

        java.util.Map<String, Object> stats = new java.util.HashMap<>();
        stats.put("totalBroadcasts", 3L);
        stats.put("sent", 2L);
        stats.put("unread", 5L);
        stats.put("successRate", 95.0);
        when(adminNotificationService.dashboardStats()).thenReturn(stats);

        mockMvc.perform(get("/api/v1/admin/notification-center/dashboard")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Notification dashboard fetched"))
                .andExpect(jsonPath("$.data.totalBroadcasts").value(3))
                .andExpect(jsonPath("$.data.unread").value(5))
                .andExpect(jsonPath("$.data.successRate").value(95.0));
    }

    @Test
    void notificationHistory_returnsOk() throws Exception {
        loginAs(adminUser);

        java.util.Map<String, Object> row = new java.util.HashMap<>();
        row.put("id", 7L);
        row.put("title", "Maintenance window");
        row.put("status", "SENT");
        row.put("type", "MAINTENANCE");
        when(adminNotificationService.history(any(), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(row)));

        mockMvc.perform(get("/api/v1/admin/notification-center")
                        .param("status", "SENT")
                        .param("q", "Maintenance")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast history fetched"))
                .andExpect(jsonPath("$.data.content[0].id").value(7))
                .andExpect(jsonPath("$.data.content[0].title").value("Maintenance window"));
    }

    @Test
    void notificationDetail_returnsOk() throws Exception {
        loginAs(adminUser);

        java.util.Map<String, Object> row = new java.util.HashMap<>();
        row.put("id", 7L);
        row.put("title", "v2.0 release");
        row.put("delivered", 120L);
        row.put("read", 80L);
        row.put("unread", 40L);
        when(adminNotificationService.detail(7L)).thenReturn(row);

        mockMvc.perform(get("/api/v1/admin/notification-center/7")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast fetched"))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.read").value(80));
    }

    @Test
    void notificationRecipients_returnsOk() throws Exception {
        loginAs(adminUser);

        java.util.Map<String, Object> recipient = new java.util.HashMap<>();
        recipient.put("id", 11L);
        recipient.put("userId", 10L);
        recipient.put("userName", "Test Learner");
        recipient.put("read", true);
        when(adminNotificationService.recipients(eq(7L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(recipient)));

        mockMvc.perform(get("/api/v1/admin/notification-center/7/recipients")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Recipients fetched"))
                .andExpect(jsonPath("$.data.content[0].userName").value("Test Learner"))
                .andExpect(jsonPath("$.data.content[0].read").value(true));
    }

    @Test
    void createBroadcast_returnsOk() throws Exception {
        loginAs(adminUser);

        com.skillswap.notification.NotificationBroadcast b = new com.skillswap.notification.NotificationBroadcast();
        b.setId(9L);
        b.setTitle("Security alert");
        b.setType("SECURITY_ALERT");
        b.setStatus("SENT");
        b.setDeliveredCount(10);
        b.setCreatedAt(OffsetDateTime.now());
        when(adminNotificationService.createBroadcast(
                any(User.class), anyString(), any(), anyString(), anyString(), any(), any(), any(),
                any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(b);

        mockMvc.perform(post("/api/v1/admin/notification-center")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Security alert", "message": "Please reset your password", "type": "SECURITY_ALERT"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast created"))
                .andExpect(jsonPath("$.data.id").value(9))
                .andExpect(jsonPath("$.data.type").value("SECURITY_ALERT"));
    }

    @Test
    void createBroadcast_rejectsMissingTitle() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(post("/api/v1/admin/notification-center")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "", "message": "Test"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.errors.title").value("must not be blank"));
    }

    @Test
    void sendBroadcastNow_returnsOk() throws Exception {
        loginAs(adminUser);

        com.skillswap.notification.NotificationBroadcast b = new com.skillswap.notification.NotificationBroadcast();
        b.setId(9L);
        b.setTitle("Draft");
        b.setStatus("SENT");
        b.setDeliveredCount(25);
        b.setCreatedAt(OffsetDateTime.now());
        when(adminNotificationService.sendNow(any(User.class), eq(9L))).thenReturn(b);

        mockMvc.perform(post("/api/v1/admin/notification-center/9/send")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast sent"))
                .andExpect(jsonPath("$.data.status").value("SENT"));
    }

    @Test
    void cancelBroadcast_returnsOk() throws Exception {
        loginAs(adminUser);

        com.skillswap.notification.NotificationBroadcast b = new com.skillswap.notification.NotificationBroadcast();
        b.setId(9L);
        b.setTitle("Scheduled");
        b.setStatus("CANCELLED");
        b.setCancelledAt(OffsetDateTime.now());
        b.setCreatedAt(OffsetDateTime.now());
        when(adminNotificationService.cancelScheduled(any(User.class), eq(9L))).thenReturn(b);

        mockMvc.perform(post("/api/v1/admin/notification-center/9/cancel")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast cancelled"))
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    @Test
    void duplicateBroadcast_returnsOk() throws Exception {
        loginAs(adminUser);

        com.skillswap.notification.NotificationBroadcast b = new com.skillswap.notification.NotificationBroadcast();
        b.setId(10L);
        b.setTitle("Copy of X");
        b.setStatus("DRAFT");
        b.setCreatedAt(OffsetDateTime.now());
        when(adminNotificationService.duplicate(any(User.class), eq(9L))).thenReturn(b);

        mockMvc.perform(post("/api/v1/admin/notification-center/9/duplicate")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast duplicated"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    void archiveBroadcast_returnsOk() throws Exception {
        loginAs(adminUser);

        com.skillswap.notification.NotificationBroadcast b = new com.skillswap.notification.NotificationBroadcast();
        b.setId(9L);
        b.setTitle("Old");
        b.setStatus("ARCHIVED");
        b.setArchivedAt(OffsetDateTime.now());
        b.setCreatedAt(OffsetDateTime.now());
        when(adminNotificationService.archive(any(User.class), eq(9L))).thenReturn(b);

        mockMvc.perform(post("/api/v1/admin/notification-center/9/archive")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast archived"))
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    @Test
    void resendBroadcast_returnsOk() throws Exception {
        loginAs(adminUser);

        when(adminNotificationService.resendToUnread(any(User.class), eq(9L))).thenReturn(3);

        mockMvc.perform(post("/api/v1/admin/notification-center/9/resend")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast resent"))
                .andExpect(jsonPath("$.data.resent").value(3));
    }

    @Test
    void deleteBroadcast_returnsOk() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(delete("/api/v1/admin/notification-center/9")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast deleted"))
                .andExpect(jsonPath("$.data.deletedBroadcastId").value(9));

        verify(adminNotificationService).delete(any(User.class), eq(9L));
    }

    @Test
    void notificationAnalytics_returnsOk() throws Exception {
        loginAs(adminUser);

        java.util.Map<String, Object> analytics = new java.util.HashMap<>();
        analytics.put("readRate", 72.5);
        analytics.put("clickRate", 14.0);
        analytics.put("monthly", List.of());
        analytics.put("mostOpened", List.of());
        when(adminNotificationService.analytics(anyInt())).thenReturn(analytics);

        mockMvc.perform(get("/api/v1/admin/notification-center/analytics")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Notification analytics fetched"))
                .andExpect(jsonPath("$.data.readRate").value(72.5));
    }

    @Test
    void notificationCenter_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(get("/api/v1/admin/notification-center/dashboard")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /audit-log
    // ══════════════════════════════════════════════════════════════

    @Test
    void getAuditLog_returnsOk() throws Exception {
        loginAs(adminUser);

        AuditLog log = new AuditLog();
        log.setId(1L);
        log.setAdminId(1L);
        log.setAdminEmail("admin@skillswap.com");
        log.setAction("UPDATE_SETTINGS");
        log.setEntityType("Settings");
        log.setDetails("Updated platform fee to 15%");
        log.setIpAddress("127.0.0.1");
        log.setCreatedAt(OffsetDateTime.now());

        when(auditLogRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));

        mockMvc.perform(get("/api/v1/admin/audit-log")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Audit log fetched"))
                .andExpect(jsonPath("$.data.content[0].action").value("UPDATE_SETTINGS"))
                .andExpect(jsonPath("$.data.content[0].adminEmail").value("admin@skillswap.com"))
                .andExpect(jsonPath("$.data.content[0].ipAddress").value("127.0.0.1"));
    }

    @Test
    void getAuditLog_filtersByAction() throws Exception {
        loginAs(adminUser);

        AuditLog log = new AuditLog();
        log.setId(2L);
        log.setAdminId(1L);
        log.setAdminEmail("admin@skillswap.com");
        log.setAction("BULK_ENABLE_USERS");
        log.setEntityType("User");
        log.setDetails("Enabled 5 users");
        log.setCreatedAt(OffsetDateTime.now());

        when(auditLogRepository.findByActionContainingIgnoreCaseOrderByCreatedAtDesc(
                        eq("ENABLE"), any(Pageable.class)))
                .thenReturn(List.of(log));
        when(auditLogRepository.countByActionContainingIgnoreCase(eq("ENABLE"))).thenReturn(1L);

        mockMvc.perform(get("/api/v1/admin/audit-log?action=ENABLE")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].action").value("BULK_ENABLE_USERS"));
    }

    @Test
    void getAuditLog_surfacesAuthEvents() throws Exception {
        loginAs(adminUser);

        // Login/logout entries are not admin actions — they carry userId +
        // resource fields (no admin_id) so the UI can attribute them.
        AuditLog log = new AuditLog();
        log.setId(3L);
        log.setAction("LOGIN");
        log.setResource("Auth");
        log.setResourceId(10L);
        log.setUserId(10L);
        log.setDetails("learner@test.com");
        log.setIpAddress("203.0.113.7");
        log.setCreatedAt(OffsetDateTime.now());

        when(auditLogRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));

        mockMvc.perform(get("/api/v1/admin/audit-log")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].action").value("LOGIN"))
                .andExpect(jsonPath("$.data.content[0].userId").value(10))
                .andExpect(jsonPath("$.data.content[0].resource").value("Auth"))
                .andExpect(jsonPath("$.data.content[0].resourceId").value(10))
                .andExpect(jsonPath("$.data.content[0].ipAddress").value("203.0.113.7"));
    }

    // ══════════════════════════════════════════════════════════════
    //  Activity Timeline — stats / detail / security-alerts / retention
    // ══════════════════════════════════════════════════════════════

    @Test
    void auditLogStats_returnsRealCounts() throws Exception {
        loginAs(adminUser);

        when(auditLogRepository.countByArchivedAtIsNull()).thenReturn(1200L);
        when(auditLogRepository.countByArchivedAtIsNullAndCreatedAtAfter(any())).thenReturn(35L);
        when(auditLogRepository.countByModuleAndArchivedAtIsNullAndCreatedAtAfter(any(), any())).thenReturn(4L);
        when(auditLogRepository.countByAdminIdIsNotNullAndArchivedAtIsNullAndCreatedAtAfter(any())).thenReturn(9L);
        when(auditLogRepository.countByActionContainingIgnoreCaseAndCreatedAtAfter(any(), any())).thenReturn(2L);
        when(auditLogRepository.countBySeverityAndCreatedAtAfter(any(), any())).thenReturn(1L);
        when(auditLogRepository.countGroupedBySeveritySince(any()))
                .thenReturn(List.of(new Object[]{"INFO", 800L}, new Object[]{"CRITICAL", 12L}));
        when(auditLogRepository.countGroupedByModuleSince(any()))
                .thenReturn(List.<Object[]>of(new Object[]{"AUTH", 300L}));
        when(auditLogRepository.countDailyTrendSince(any()))
                .thenReturn(List.<Object[]>of(new Object[]{"2026-01-01", 5L}));

        mockMvc.perform(get("/api/v1/admin/audit-log/stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Audit stats fetched"))
                .andExpect(jsonPath("$.data.totalLogs").value(1200))
                .andExpect(jsonPath("$.data.todayActivities").value(35))
                .andExpect(jsonPath("$.data.securityEvents24h").value(4))
                .andExpect(jsonPath("$.data.adminActions30d").value(9))
                .andExpect(jsonPath("$.data.failedLogins24h").value(2))
                .andExpect(jsonPath("$.data.bySeverity.length()").value(2))
                .andExpect(jsonPath("$.data.byModule[0].label").value("AUTH"))
                .andExpect(jsonPath("$.data.dailyTrend[0].label").value("2026-01-01"));
    }

    @Test
    void auditLogDetail_returnsEntry() throws Exception {
        loginAs(adminUser);

        AuditLog log = new AuditLog();
        log.setId(42L);
        log.setAction("LOGIN");
        log.setModule("AUTH");
        log.setSeverity("SUCCESS");
        log.setOutcome("SUCCESS");
        log.setUserId(10L);
        log.setIpAddress("203.0.113.7");
        log.setDevice("Desktop");
        log.setBrowser("Chrome");
        log.setOs("Windows NT 10.0");
        log.setRequestId("req-123");
        log.setEndpoint("POST /api/v1/auth/login");
        log.setCreatedAt(OffsetDateTime.now());

        when(auditLogRepository.findById(42L)).thenReturn(Optional.of(log));

        mockMvc.perform(get("/api/v1/admin/audit-log/42")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Audit entry fetched"))
                .andExpect(jsonPath("$.data.id").value(42))
                .andExpect(jsonPath("$.data.severity").value("SUCCESS"))
                .andExpect(jsonPath("$.data.module").value("AUTH"))
                .andExpect(jsonPath("$.data.browser").value("Chrome"))
                .andExpect(jsonPath("$.data.requestId").value("req-123"));
    }

    @Test
    void auditLogDetail_returnsNotFound() throws Exception {
        loginAs(adminUser);

        when(auditLogRepository.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/admin/audit-log/999")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Audit log entry not found"));
    }

    @Test
    void auditLogSecurityAlerts_returnsAlerts() throws Exception {
        loginAs(adminUser);

        when(auditLogRepository.repeatedFailedLoginsByIp(any()))
                .thenReturn(List.<Object[]>of(new Object[]{"203.0.113.7", 6L}));
        when(auditLogRepository.repeatedPasswordResets(any()))
                .thenReturn(List.<Object[]>of(new Object[]{"10L", 3L}));
        when(auditLogRepository.repeatedAccountDisables(any()))
                .thenReturn(List.of());
        when(auditLogRepository.privilegeChangesSince(any(), any(Pageable.class)))
                .thenReturn(List.of());
        when(auditLogRepository.errorsSince(any(), any(Pageable.class)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/audit-log/security-alerts")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Security alerts fetched"))
                .andExpect(jsonPath("$.data.totalAlerts").value(2))
                .andExpect(jsonPath("$.data.repeatedFailedLogins[0].key").value("203.0.113.7"))
                .andExpect(jsonPath("$.data.repeatedFailedLogins[0].count").value(6))
                .andExpect(jsonPath("$.data.repeatedPasswordResets[0].count").value(3));
    }

    @Test
    void auditLogRetention_returnsCurrentPolicy() throws Exception {
        loginAs(adminUser);

        when(auditLogService.configuredRetentionDays()).thenReturn(90);
        when(auditLogRepository.countExpired(any())).thenReturn(7L);

        mockMvc.perform(get("/api/v1/admin/audit-log/retention")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Retention fetched"))
                .andExpect(jsonPath("$.data.days").value(90))
                .andExpect(jsonPath("$.data.expiredCount").value(7));
    }

    @Test
    void auditLogRetention_updatesPolicy() throws Exception {
        loginAs(adminUser);

        when(adminSettingRepository.findBySettingKey("audit_retention_days"))
                .thenReturn(Optional.empty());
        when(adminSettingRepository.save(any(AdminSetting.class))).thenAnswer(inv -> inv.getArgument(0));
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/v1/admin/audit-log/retention")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"days": 180}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Retention updated"))
                .andExpect(jsonPath("$.data.days").value(180));

        // The retention change itself is recorded in the audit trail.
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void auditLogPurge_returnsRemovedCount() throws Exception {
        loginAs(adminUser);

        when(auditLogService.configuredRetentionDays()).thenReturn(365);
        when(auditLogService.purgeOlderThan(any())).thenReturn(23);

        mockMvc.perform(post("/api/v1/admin/audit-log/purge")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Audit logs purged"))
                .andExpect(jsonPath("$.data.removed").value(23))
                .andExpect(jsonPath("$.data.cutoffDays").value(365));
    }

    @Test
    void getAuditLog_filtersByAdvancedFilters() throws Exception {
        loginAs(adminUser);

        AuditLog log = new AuditLog();
        log.setId(9L);
        log.setAction("LOGIN");
        log.setModule("AUTH");
        log.setSeverity("SUCCESS");
        log.setUserId(10L);
        log.setCreatedAt(OffsetDateTime.now());

        when(auditLogRepository.findByFilters(any(), any(), any(), any(), any(), any(), any(), any(),
                anyBoolean(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));

        mockMvc.perform(get("/api/v1/admin/audit-log?module=AUTH&severity=SUCCESS&q=login")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Audit log fetched"))
                .andExpect(jsonPath("$.data.content[0].module").value("AUTH"))
                .andExpect(jsonPath("$.data.content[0].severity").value("SUCCESS"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /settings
    // ══════════════════════════════════════════════════════════════

    @Test
    void getSettings_returnsOk() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(get("/api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Settings fetched"))
                .andExpect(jsonPath("$.data.platform_fee_percent").value("10"))
                .andExpect(jsonPath("$.data.maintenance_mode").value("false"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PUT /settings
    // ══════════════════════════════════════════════════════════════

    @Test
    void updateSettings_returnsOk() throws Exception {
        loginAs(adminUser);

        AdminSetting feeSetting = new AdminSetting();
        feeSetting.setId(1L);
        feeSetting.setSettingKey("platform_fee_percent");
        feeSetting.setSettingValue("15");

        AdminSetting maintenanceSetting = new AdminSetting();
        maintenanceSetting.setId(2L);
        maintenanceSetting.setSettingKey("maintenance_mode");
        maintenanceSetting.setSettingValue("true");

        when(adminSettingRepository.findBySettingKey("platform_fee_percent"))
                .thenReturn(Optional.empty());
        when(adminSettingRepository.findBySettingKey("maintenance_mode"))
                .thenReturn(Optional.empty());
        when(adminSettingRepository.save(any(AdminSetting.class)))
                .thenReturn(feeSetting, maintenanceSetting);
        // The controller delegates persistence to the mocked AdminService —
        // return the written keys so the per-key audit loop actually runs.
        when(adminService.persistSettings(any()))
                .thenReturn(new java.util.LinkedHashSet<>(List.of("platform_fee_percent", "maintenance_mode")));
        // First findAll() feeds the before-values (defaults only), the second
        // feeds the response after the settings have been written.
        when(adminSettingRepository.findAll())
                .thenReturn(List.of(), List.of(feeSetting, maintenanceSetting));

        mockMvc.perform(put("/api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"settings": {"platform_fee_percent": "15", "maintenance_mode": "true"}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Settings updated"))
                .andExpect(jsonPath("$.data.platform_fee_percent").value("15"))
                .andExpect(jsonPath("$.data.maintenance_mode").value("true"));

        // Per-key audit trail — each changed setting is logged with old → new.
        verify(auditLogRepository, atLeast(2)).save(any(AuditLog.class));
    }

    @Test
    void updateSettings_skipsUnchangedKeys() throws Exception {
        loginAs(adminUser);

        when(adminSettingRepository.findAll())
                .thenReturn(List.of());

        mockMvc.perform(put("/api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"settings": {"platform_fee_percent": "10"}}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("No settings changed"));

        verify(adminService, never()).persistSettings(any());
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /settings/catalog
    // ══════════════════════════════════════════════════════════════

    @Test
    void getSettingsCatalog_returnsCategoriesFromCatalog() throws Exception {
        loginAs(adminUser);

        // No stored rows → the response is seeded with catalog defaults.
        when(adminSettingRepository.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/settings/catalog")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Settings catalog fetched"))
                .andExpect(jsonPath("$.data.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(8)))
                // Categories follow the catalog order: general(0) … maintenance(11).
                .andExpect(jsonPath("$.data[2].id").value("security"))
                .andExpect(jsonPath("$.data[2].fields.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data[11].id").value("maintenance"))
                .andExpect(jsonPath("$.data[11].fields.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /settings/reset-section
    // ══════════════════════════════════════════════════════════════

    @Test
    void resetSettingsSection_resetsCategory() throws Exception {
        loginAs(adminUser);

        when(adminService.resetSettingsSection(eq("security"))).thenReturn(4);

        mockMvc.perform(post("/api/v1/admin/settings/reset-section")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"category": "security"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Settings section reset"))
                .andExpect(jsonPath("$.data.reset").value(4))
                .andExpect(jsonPath("$.data.category").value("security"));

        verify(auditLogRepository, atLeastOnce()).save(any(AuditLog.class));
    }

    @Test
    void resetSettingsSection_requiresCategory() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(post("/api/v1/admin/settings/reset-section")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {}
                                """))
                .andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /settings/reset-all
    // ══════════════════════════════════════════════════════════════

    @Test
    void resetAllSettings_resetsAllKeys() throws Exception {
        loginAs(adminUser);

        when(adminService.resetAllSettings()).thenReturn(42);

        mockMvc.perform(post("/api/v1/admin/settings/reset-all")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("All settings reset"))
                .andExpect(jsonPath("$.data.reset").value(42));

        verify(auditLogRepository, atLeastOnce()).save(any(AuditLog.class));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /settings/export
    // ══════════════════════════════════════════════════════════════

    @Test
    void exportSettings_returnsCsvBlob() throws Exception {
        loginAs(adminUser);

        when(adminSettingRepository.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/settings/export")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Content-Disposition",
                                org.hamcrest.Matchers.containsString("skillswap-settings.csv")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .content().string(org.hamcrest.Matchers.containsString("category,key,type,label,value")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .content().string(org.hamcrest.Matchers.containsString("maintenance_mode")));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /settings/logs
    // ══════════════════════════════════════════════════════════════

    @Test
    void getSettingsLogs_returnsBufferedLogs() throws Exception {
        loginAs(adminUser);

        when(systemHealthService.recentLogs(eq("ERROR"), any(), anyInt()))
                .thenReturn(List.of(new com.skillswap.monitoring.LogBufferService.LogEntry(
                        "2026-01-01T00:00:00Z", "AdminController", "ERROR", "settings update failed")));

        mockMvc.perform(get("/api/v1/admin/settings/logs?level=ERROR&limit=50")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logs fetched"))
                .andExpect(jsonPath("$.data[0].level").value("ERROR"))
                .andExpect(jsonPath("$.data[0].message").value("settings update failed"));
    }

    // ══════════════════════════════════════════════════════════════
    //  POST /settings/clear-cache
    // ══════════════════════════════════════════════════════════════

    @Test
    void clearSettingsCache_returnsCleared() throws Exception {
        loginAs(adminUser);

        mockMvc.perform(post("/api/v1/admin/settings/clear-cache")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Cache cleared"))
                .andExpect(jsonPath("$.data.cache").value("cleared"));

        verify(maintenanceModeFilter).invalidateCache();
        verify(auditLogRepository, atLeastOnce()).save(any(AuditLog.class));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /reports
    // ══════════════════════════════════════════════════════════════

    @Test
    void reports_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(1L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findByFilters(any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(report)));

        mockMvc.perform(get("/api/v1/admin/reports")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Reports fetched"))
                .andExpect(jsonPath("$.data.content[0].id").value(1));
    }

    @Test
    void reports_filtersByTargetType() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(2L);
        report.setStatus(ReportStatus.OPEN);
        report.setTargetType("SKILL");

        when(reportRepository.findByFilters(any(), eq("SKILL"), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(report)));

        mockMvc.perform(get("/api/v1/admin/reports?targetType=SKILL")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Reports fetched"))
                .andExpect(jsonPath("$.data.content[0].id").value(2))
                .andExpect(jsonPath("$.data.content[0].targetType").value("SKILL"));
    }

    @Test
    void reports_filtersBySearchQuery() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(3L);
        report.setStatus(ReportStatus.OPEN);
        report.setTargetType("SESSION");
        report.setTargetLabel("Java Masterclass");
        report.setReason("Misleading");

        when(reportRepository.findByFilters(any(), any(), any(), any(), any(), eq("Java"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(report)));

        mockMvc.perform(get("/api/v1/admin/reports?q=Java")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Reports fetched"))
                .andExpect(jsonPath("$.data.content.length()").value(1));
    }

    @Test
    void reports_filtersByPriorityAndDates() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);
        report.setPriority(ReportPriority.HIGH);

        when(reportRepository.findByFilters(any(), any(), eq(ReportPriority.HIGH),
                any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(report)));

        mockMvc.perform(get("/api/v1/admin/reports?priority=HIGH&fromDate=2026-01-01&toDate=2026-12-31")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].priority").value("HIGH"));
    }

    @Test
    void reportStats_returnsRealCounts() throws Exception {
        loginAs(adminUser);

        when(reportRepository.countGroupedByStatus()).thenReturn(List.of(
                new Object[]{ReportStatus.OPEN, 3L},
                new Object[]{ReportStatus.IN_REVIEW, 2L},
                new Object[]{ReportStatus.RESOLVED, 5L},
                new Object[]{ReportStatus.REJECTED, 1L}));
        when(userRepository.countByEnabledFalse()).thenReturn(4L);

        mockMvc.perform(get("/api/v1/admin/reports/stats")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report stats fetched"))
                .andExpect(jsonPath("$.data.total").value(11))
                .andExpect(jsonPath("$.data.open").value(3))
                .andExpect(jsonPath("$.data.inReview").value(2))
                .andExpect(jsonPath("$.data.resolved").value(5))
                .andExpect(jsonPath("$.data.rejected").value(1))
                .andExpect(jsonPath("$.data.suspendedUsers").value(4));
    }

    @Test
    void reportDetail_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);
        report.setTargetType("MENTOR");
        report.setTargetLabel("Test Mentor");
        report.setReason("Harassment");
        report.setReporter(learnerUser);
        report.setReported(mentorUser);
        report.setPriority(ReportPriority.MEDIUM);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));

        mockMvc.perform(get("/api/v1/admin/reports/4")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report fetched"))
                .andExpect(jsonPath("$.data.id").value(4))
                .andExpect(jsonPath("$.data.reporterName").value("Test Learner"))
                .andExpect(jsonPath("$.data.reportedName").value("Test Mentor"))
                .andExpect(jsonPath("$.data.priority").value("MEDIUM"));
    }

    @Test
    void reportDetail_rejectsSoftDeleted() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);
        report.setDeletedAt(OffsetDateTime.now());

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));

        mockMvc.perform(get("/api/v1/admin/reports/4")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Report not found"));
    }

    @Test
    void assignReport_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/4/assign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report assigned"))
                .andExpect(jsonPath("$.data.status").value("IN_REVIEW"));

        verify(auditLogRepository).save(any());
    }

    @Test
    void setReportStatus_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/4/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "IN_REVIEW"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report status updated"))
                .andExpect(jsonPath("$.data.status").value("IN_REVIEW"));
    }

    @Test
    void setReportStatus_rejectsDecisionStatuses() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));

        mockMvc.perform(patch("/api/v1/admin/reports/4/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Use the decision endpoint to resolve or reject a report"));
    }

    @Test
    void setReportPriority_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/4/priority")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"priority": "CRITICAL"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report priority updated"))
                .andExpect(jsonPath("$.data.priority").value("CRITICAL"));
    }

    @Test
    void addReportNote_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/4/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note": "Interviewed both parties"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Note added"))
                .andExpect(jsonPath("$.data.internalNotes")
                        .value(org.hamcrest.Matchers.containsString("Interviewed both parties")));
    }

    @Test
    void setReportedUserEnabled_suspendsUser() throws Exception {
        loginAs(adminUser);

        // Pin the shared fixture to a clean enabled state — other tests may
        // have disabled it, and the controller rejects already-suspended users.
        mentorUser.setEnabled(true);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);
        report.setReported(mentorUser);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/4/user-enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User suspended"))
                .andExpect(jsonPath("$.data.reportedEnabled").value(false));

        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(20L),
                org.mockito.ArgumentMatchers.eq("ACCOUNT_SUSPENDED"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void setReportedUserEnabled_restoresUser() throws Exception {
        loginAs(adminUser);

        mentorUser.setEnabled(false);
        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.RESOLVED);
        report.setReported(mentorUser);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/4/user-enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User restored"))
                .andExpect(jsonPath("$.data.reportedEnabled").value(true));

        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(20L),
                org.mockito.ArgumentMatchers.eq("ACCOUNT_RESTORED"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void deleteReport_softDeletes() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(4L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(4L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(delete("/api/v1/admin/reports/4")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report deleted"))
                .andExpect(jsonPath("$.data.deletedReportId").value(4));

        verify(auditLogRepository).save(any());
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /reports/{id}
    // ══════════════════════════════════════════════════════════════

    @Test
    void updateReport_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(1L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenReturn(report);

        mockMvc.perform(patch("/api/v1/admin/reports/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report updated"));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /reports/{id}/decision
    // ══════════════════════════════════════════════════════════════

    @Test
    void decideReport_resolvesWithNote() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(7L);
        report.setStatus(ReportStatus.OPEN);
        report.setReporter(learnerUser);

        when(reportRepository.findById(7L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/7/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED", "note": "Warning issued", "suspendUser": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Report decision applied"))
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.moderatorNote").value("Warning issued"));

        verify(auditLogRepository).save(any());
    }

    @Test
    void decideReport_rejectsReport() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(8L);
        report.setStatus(ReportStatus.OPEN);
        report.setReporter(learnerUser);

        when(reportRepository.findById(8L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/8/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED", "note": "No violation found"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        verify(auditLogRepository).save(any());
    }

    @Test
    void decideReport_suspendsReportedUser() throws Exception {
        loginAs(adminUser);

        // Reset the shared mentor fixture to a clean enabled state — other tests
        // may have disabled it, and the controller only suspends enabled users.
        mentorUser.setEnabled(true);

        UserReport report = new UserReport();
        report.setId(9L);
        report.setStatus(ReportStatus.OPEN);
        report.setReporter(learnerUser);
        report.setReported(mentorUser);

        when(reportRepository.findById(9L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(patch("/api/v1/admin/reports/9/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED", "note": "Suspending for harassment", "suspendUser": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"));

        // Mentor account must be disabled and both audit log entries written.
        verify(userRepository).save(mentorUser);
        org.junit.jupiter.api.Assertions.assertFalse(mentorUser.isEnabled());
        verify(auditLogRepository, atLeastOnce()).save(any());
        verify(notificationService).notifyUser(
                org.mockito.ArgumentMatchers.eq(20L),
                org.mockito.ArgumentMatchers.eq("ACCOUNT_SUSPENDED"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void decideReport_rejectsInvalidStatus() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(10L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(10L)).thenReturn(Optional.of(report));

        mockMvc.perform(patch("/api/v1/admin/reports/10/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "OPEN", "note": ""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Decision must be RESOLVED or REJECTED"));
    }

    @Test
    void decideReport_rejectsAlreadyDecided() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(11L);
        report.setStatus(ReportStatus.RESOLVED);

        when(reportRepository.findById(11L)).thenReturn(Optional.of(report));

        mockMvc.perform(patch("/api/v1/admin/reports/11/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "REJECTED"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Report is already RESOLVED"));
    }

    @Test
    void decideReport_rejectsNonAdmin() throws Exception {
        loginAs(learnerUser);

        mockMvc.perform(patch("/api/v1/admin/reports/7/decision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Only admins can access this area"));

        verify(reportRepository, never()).findById(anyLong());
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /conversations
    // ══════════════════════════════════════════════════════════════

    @Test
    void listConversations_returnsOk() throws Exception {
        loginAs(adminUser);

        SkillSession session = new SkillSession();
        session.setId(100L);
        session.setTitle("Test Session");
        session.setMentor(mentorUser);

        Booking booking = new Booking();
        booking.setId(1L);
        booking.setSession(session);
        booking.setLearner(learnerUser);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setCreatedAt(OffsetDateTime.now());

        when(bookingRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(booking)));
        when(directConversationRepository.findAllWithParticipants(any(Pageable.class)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/conversations")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Conversations fetched"))
                .andExpect(jsonPath("$.data[0].kind").value("booking"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /mentor-verifications
    // ══════════════════════════════════════════════════════════════

    @Test
    void mentorVerifications_returnsOk() throws Exception {
        loginAs(adminUser);

        MentorVerificationRequest request = new MentorVerificationRequest();
        request.setId(1L);
        request.setMentor(mentorUser);
        request.setStatus(MentorVerificationRequestStatus.PENDING);
        request.setDocumentUrl("https://example.com/id.pdf");
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());

        when(mentorCertificationService.listForMentor(20L)).thenReturn(List.of());
        when(mentorVerificationRepository.findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus.PENDING))
                .thenReturn(List.of(request));

        mockMvc.perform(get("/api/v1/admin/mentor-verifications")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification queue fetched"))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].mentor.email").value("mentor@test.com"))
                .andExpect(jsonPath("$.data[0].certifications").isArray());
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /flagged-content
    // ══════════════════════════════════════════════════════════════

    @Test
    void getFlaggedContent_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(5L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(ReportStatus.OPEN))
                .thenReturn(List.of(report));

        mockMvc.perform(get("/api/v1/admin/flagged-content")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Flagged content fetched"))
                .andExpect(jsonPath("$.data[0].id").value(5));
    }

    // ══════════════════════════════════════════════════════════════
    //  PATCH /flagged-content/{id}
    // ══════════════════════════════════════════════════════════════

    @Test
    void moderateContent_returnsOk() throws Exception {
        loginAs(adminUser);

        UserReport report = new UserReport();
        report.setId(5L);
        report.setStatus(ReportStatus.OPEN);

        when(reportRepository.findById(5L)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(UserReport.class))).thenReturn(report);

        mockMvc.perform(patch("/api/v1/admin/flagged-content/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED", "note": "No violation found"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Content moderated"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /conversations/booking/{bookingId}/messages
    // ══════════════════════════════════════════════════════════════

    @Test
    void getBookingConversationMessages_returnsOk() throws Exception {
        loginAs(adminUser);

        ChatMessage msg = new ChatMessage();
        msg.setId(10L);
        msg.setContent("Hello, I'm interested in this session");
        msg.setSender(learnerUser);
        msg.setCreatedAt(OffsetDateTime.now());

        when(chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(1L))
                .thenReturn(List.of(msg));

        mockMvc.perform(get("/api/v1/admin/conversations/booking/1/messages")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Messages fetched"))
                .andExpect(jsonPath("$.data[0].content").value("Hello, I'm interested in this session"));
    }

    // ══════════════════════════════════════════════════════════════
    //  GET /conversations/direct/{conversationId}/messages
    // ══════════════════════════════════════════════════════════════

    @Test
    void getDirectConversationMessages_returnsOk() throws Exception {
        loginAs(adminUser);

        DirectMessage msg = new DirectMessage();
        msg.setId(20L);
        msg.setContent("Direct message test");
        msg.setSender(learnerUser);
        msg.setReadByRecipient(false);
        msg.setCreatedAt(OffsetDateTime.now());

        when(directMessageRepository.findByConversationIdOrderByCreatedAtAsc(5L))
                .thenReturn(List.of(msg));

        mockMvc.perform(get("/api/v1/admin/conversations/direct/5/messages")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Messages fetched"))
                .andExpect(jsonPath("$.data[0].content").value("Direct message test"));
    }
}
