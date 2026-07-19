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
import com.skillswap.referral.ReferralRewardRepository;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReport;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.session.SessionStatus;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequest;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletService;
import com.skillswap.wallet.WalletTransactionType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
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
    private ReferralRewardRepository referralRewardRepository;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;
    @MockitoBean
    private RequestTraceFilter requestTraceFilter;
    @MockitoBean
    private UserDetailsService userDetailsService;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

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
        learnerUser.setEnabled(true);
        learnerUser.setCreatedAt(OffsetDateTime.now().minusDays(30));

        mentorUser = new User();
        mentorUser.setId(20L);
        mentorUser.setEmail("mentor@test.com");
        mentorUser.setFullName("Test Mentor");
        mentorUser.setRole(UserRole.MENTOR);
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
        when(bookingRepository.count()).thenReturn(0L);
        when(bookingRepository.countByBookingStatus(BookingStatus.COMPLETED)).thenReturn(0L);
        when(userRepository.countByLastActiveAtAfter(any())).thenReturn(2L);
        when(userRepository.countByCreatedAtAfter(any())).thenReturn(0L);
        when(paymentRepository.computeMonthlySignupTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlyRevenueTrend(any())).thenReturn(List.of());
        when(paymentRepository.computeMonthlySessionTrend(any())).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/admin/dashboard")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Dashboard data fetched"))
                .andExpect(jsonPath("$.data.signupTrend").isArray())
                .andExpect(jsonPath("$.data.revenueTrend").isArray())
                .andExpect(jsonPath("$.data.sessionTrend").isArray())
                .andExpect(jsonPath("$.data.health").exists())
                .andExpect(jsonPath("$.data.health.totalUsers").value(2));
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

        mockMvc.perform(get("/api/v1/admin/dashboard?months=3")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.signupTrend.length()").value(3));
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

        when(userRepository.count()).thenReturn(50L);
        when(bookingRepository.count()).thenReturn(200L);
        when(reportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.OPEN)).thenReturn(List.of());
        when(auditLogRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(auditLogRepository.findByActionContainingIgnoreCaseOrderByCreatedAtDesc(anyString(), any(Pageable.class)))
                .thenReturn(List.of());

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
        when(bookingRepository.findAll()).thenReturn(List.of(booking));

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

        when(userRepository.findAll()).thenReturn(List.of(learnerUser, mentorUser));
        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("100.00"), "CREDITS"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Users fetched"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void listUsers_filtersByRole() throws Exception {
        loginAs(adminUser);

        when(userRepository.findAll()).thenReturn(List.of(learnerUser, mentorUser));
        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("0"), "CREDITS"));

        mockMvc.perform(get("/api/v1/admin/users?role=MENTOR")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].role").value("MENTOR"));
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
                .andExpect(jsonPath("$.message").value("User status updated"));
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
        session.setSessionType("one-on-one");
        session.setStartTime(OffsetDateTime.now().plusDays(1));
        session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(2));
        session.setMaxParticipants(5);
        session.setCreatedAt(OffsetDateTime.now());

        when(sessionRepository.findAll()).thenReturn(List.of(session));

        mockMvc.perform(get("/api/v1/admin/sessions")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Sessions fetched"))
                .andExpect(jsonPath("$.data[0].id").value(100))
                .andExpect(jsonPath("$.data[0].title").value("Test Session"));
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

        when(userRepository.findAll()).thenReturn(List.of(learnerUser, mentorUser));

        mockMvc.perform(post("/api/v1/admin/notifications/broadcast")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Maintenance", "message": "Server down tonight", "targetRole": ""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Broadcast sent"))
                .andExpect(jsonPath("$.data.sentCount").value(2));
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
                .andExpect(jsonPath("$.data.error").value("Title is required"));
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
        log.setCreatedAt(OffsetDateTime.now());

        when(auditLogRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));

        mockMvc.perform(get("/api/v1/admin/audit-log")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Audit log fetched"))
                .andExpect(jsonPath("$.data[0].action").value("UPDATE_SETTINGS"))
                .andExpect(jsonPath("$.data[0].adminEmail").value("admin@skillswap.com"));
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

        mockMvc.perform(get("/api/v1/admin/audit-log?action=ENABLE")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].action").value("BULK_ENABLE_USERS"));
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
        when(adminSettingRepository.findAll())
                .thenReturn(List.of(feeSetting, maintenanceSetting));

        mockMvc.perform(put("/api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"platform_fee_percent": "15", "maintenance_mode": "true"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Settings updated"))
                .andExpect(jsonPath("$.data.platform_fee_percent").value("15"))
                .andExpect(jsonPath("$.data.maintenance_mode").value("true"));
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

        when(reportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.OPEN))
                .thenReturn(List.of(report));

        mockMvc.perform(get("/api/v1/admin/reports")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Reports fetched"))
                .andExpect(jsonPath("$.data[0].id").value(1));
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

        when(bookingRepository.findAll()).thenReturn(List.of(booking));
        when(directConversationRepository.findAll()).thenReturn(List.of());

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

        when(mentorVerificationRepository.findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus.PENDING))
                .thenReturn(List.of(request));

        mockMvc.perform(get("/api/v1/admin/mentor-verifications")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Mentor verification queue fetched"))
                .andExpect(jsonPath("$.data[0].id").value(1));
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

        when(reportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.OPEN))
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
