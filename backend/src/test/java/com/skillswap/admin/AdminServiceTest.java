package com.skillswap.admin;

import com.skillswap.common.AuditLogRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentService;
import com.skillswap.booking.BookingRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.waitlist.SessionWaitlistRepository;
import com.skillswap.wallet.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private PaymentService paymentService;

    @Mock
    private WalletService walletService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private EmailNotificationService emailNotificationService;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private AdminSettingRepository adminSettingRepository;

    @Mock
    private AdminNotifPreferenceRepository adminNotifPreferenceRepository;

    @Mock
    private UserReportRepository reportRepository;

    @Mock
    private MentorVerificationRequestRepository mentorVerificationRepository;

    @Mock
    private SessionWaitlistRepository waitlistRepository;

    private AdminService adminService;

    @Captor
    private ArgumentCaptor<AdminSetting> settingCaptor;

    @Captor
    private ArgumentCaptor<AdminNotifPreference> prefCaptor;

    private User admin;
    private User targetUser;
    private Payment payment;

    @BeforeEach
    void setUp() {
        // Manual constructor injection to avoid Mockito issues with Spring Data JPA repositories
        adminService = new AdminService(
                userRepository, bookingRepository, paymentRepository, paymentService,
                walletService, notificationService, emailNotificationService, auditLogRepository,
                sessionRepository, adminSettingRepository, adminNotifPreferenceRepository,
                reportRepository, mentorVerificationRepository,
                waitlistRepository);
        admin = new User();
        admin.setId(1L);
        admin.setEmail("admin@test.com");
        admin.setRole(UserRole.ADMIN);

        targetUser = new User();
        targetUser.setId(2L);
        targetUser.setEmail("user@test.com");
        targetUser.setFullName("Test User");
        targetUser.setRole(UserRole.LEARNER);
        targetUser.setEnabled(true);
        targetUser.setSkills("Java");
        targetUser.setGithubUrl("https://github.com/user");
        targetUser.setLinkedinUrl("https://linkedin.com/in/user");

        payment = Payment.builder()
                .id(100L)
                .amount(new BigDecimal("100.00"))
                .currency("CREDITS")
                .status(PaymentStatus.ESCROWED)
                .learnerId(1L)
                .mentorId(2L)
                .build();
    }

    // ── deleteSession ───────────────────────────────────

    @Test
    void deleteSessionDeletesSessionAndWaitlistAndAudits() {
        SkillSession session = new SkillSession();
        session.setId(500L);
        session.setTitle("Inappropriate Session");

        when(sessionRepository.findById(500L)).thenReturn(Optional.of(session));
        when(bookingRepository.countBySessionId(500L)).thenReturn(0L);

        adminService.deleteSession(admin, 500L);

        verify(waitlistRepository).deleteBySessionId(500L);
        verify(sessionRepository).delete(session);
        verify(auditLogRepository).save(argThat(log ->
                log.getAction().equals("DELETE_SESSION") &&
                log.getEntityId().equals(500L)));
    }

    @Test
    void deleteSessionThrowsWhenSessionNotFound() {
        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> adminService.deleteSession(admin, 999L));
        verify(sessionRepository, never()).delete(any());
    }

    @Test
    void deleteSessionRefusesWhenBookingsExist() {
        SkillSession session = new SkillSession();
        session.setId(500L);
        session.setTitle("Booked Session");

        when(sessionRepository.findById(500L)).thenReturn(Optional.of(session));
        when(bookingRepository.countBySessionId(500L)).thenReturn(2L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> adminService.deleteSession(admin, 500L));
        assertTrue(ex.getMessage().contains("has bookings"));
        verify(sessionRepository, never()).delete(any());
        verify(waitlistRepository, never()).deleteBySessionId(anyLong());
    }

    // ── deleteUser ──────────────────────────────────────

    @Test
    void deleteUserAnonymizesDataAndSavesAudit() {
        when(userRepository.findById(targetUser.getId())).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        adminService.deleteUser(admin, targetUser.getId(), targetUser.getEmail(), targetUser.getFullName());

        verify(userRepository).save(argThat(u -> {
            assertEquals("[Deleted User]", u.getFullName());
            assertTrue(u.getEmail().startsWith("deleted-"));
            assertTrue(u.getEmail().endsWith("@skillswap.local"));
            assertEquals("[DELETED]", u.getPasswordHash());
            assertNull(u.getAboutMe());
            assertNull(u.getSkills());
            assertNull(u.getGithubUrl());
            assertNull(u.getLinkedinUrl());
            assertNull(u.getProfileImageUrl());
            assertNull(u.getWalletAddress());
            assertFalse(u.isEnabled());
            return true;
        }));
        verify(auditLogRepository).save(argThat(log ->
                log.getAction().equals("DELETE_USER") &&
                log.getEntityId().equals(targetUser.getId())));
    }

    @Test
    void deleteUserThrowsWhenUserNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> adminService.deleteUser(admin, 999L, "email", "name"));
    }

    // ── bulk User Operations ────────────────────────────

    @Test
    void bulkEnableUsersDelegatesToRepository() {
        List<Long> ids = List.of(1L, 2L, 3L);
        when(userRepository.updateEnabledBatch(ids, true)).thenReturn(3);

        int updated = adminService.bulkEnableUsers(ids);

        assertEquals(3, updated);
        verify(userRepository).updateEnabledBatch(ids, true);
    }

    @Test
    void bulkEnableUsersReturnsZeroForEmptyList() {
        assertEquals(0, adminService.bulkEnableUsers(List.of()));
        verify(userRepository, never()).updateEnabledBatch(anyList(), anyBoolean());
    }

    @Test
    void bulkDisableUsersDelegatesToRepository() {
        List<Long> ids = List.of(1L, 2L);
        when(userRepository.updateEnabledBatch(ids, false)).thenReturn(2);

        int updated = adminService.bulkDisableUsers(ids);

        assertEquals(2, updated);
        verify(userRepository).updateEnabledBatch(ids, false);
    }

    @Test
    void bulkUpdateRoleResetsMentorVerifiedForNonMentor() {
        List<Long> ids = List.of(1L, 2L);
        when(userRepository.updateRoleBatch(ids, UserRole.LEARNER)).thenReturn(2);

        int updated = adminService.bulkUpdateRole(ids, UserRole.LEARNER);

        assertEquals(2, updated);
        verify(userRepository).resetMentorVerifiedBatch(ids);
    }

    @Test
    void bulkUpdateRoleToMentorDoesNotResetMentorVerified() {
        List<Long> ids = List.of(1L);
        when(userRepository.updateRoleBatch(ids, UserRole.MENTOR)).thenReturn(1);

        int updated = adminService.bulkUpdateRole(ids, UserRole.MENTOR);

        assertEquals(1, updated);
        verify(userRepository, never()).resetMentorVerifiedBatch(anyList());
    }

    // ── sendTestNotification ────────────────────────────

    @Test
    void sendTestNotificationSendsEmailAndAudits() {
        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        adminService.sendTestNotification(admin);

        verify(emailNotificationService).sendNotificationEmail(eq(admin), anyString(), contains("test"));
        verify(auditLogRepository).save(argThat(log ->
                log.getAction().equals("SEND_TEST_NOTIFICATION")));
    }

    // ── updateSettings ──────────────────────────────────

    @Test
    void updateSettingsCreatesOrUpdates() {
        java.util.LinkedHashMap<String, String> settings = new java.util.LinkedHashMap<>();
        settings.put("platform_fee_percent", "15");
        settings.put("maintenance_mode", "true");

        when(adminSettingRepository.findBySettingKey("platform_fee_percent")).thenReturn(Optional.empty());
        when(adminSettingRepository.findBySettingKey("maintenance_mode")).thenReturn(Optional.empty());
        when(adminSettingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        adminService.updateSettings(settings);

        verify(adminSettingRepository, times(2)).save(settingCaptor.capture());
        var saved = settingCaptor.getAllValues();
        assertEquals("platform_fee_percent", saved.get(0).getSettingKey());
        assertEquals("15", saved.get(0).getSettingValue());
        assertEquals("maintenance_mode", saved.get(1).getSettingKey());
        assertEquals("true", saved.get(1).getSettingValue());
    }

    // ── updateReportSchedule ────────────────────────────

    @Test
    void updateReportScheduleCreatesNewSetting() {
        when(adminSettingRepository.findBySettingKey("report_schedule_frequency")).thenReturn(Optional.empty());
        when(adminSettingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        adminService.updateReportSchedule("weekly");

        verify(adminSettingRepository).save(settingCaptor.capture());
        assertEquals("report_schedule_frequency", settingCaptor.getValue().getSettingKey());
        assertEquals("weekly", settingCaptor.getValue().getSettingValue());
    }

    // ── refundPayment ───────────────────────────────────

    @Test
    void refundPaymentRefundsWalletEscrowAndCreditsWallet() {
        payment.setGateway("wallet");
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));
        Payment refunded = Payment.builder()
                .id(100L)
                .amount(new BigDecimal("100.00"))
                .currency("CREDITS")
                .status(PaymentStatus.REFUNDED)
                .learnerId(1L)
                .mentorId(2L)
                .gateway("wallet")
                .build();
        when(paymentService.refundForCancellation(100L, new BigDecimal("100.00"), "Admin refund"))
                .thenReturn(refunded);
        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = adminService.refundPayment(admin, 100L, "Admin refund");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        // Gateway-first primitive is invoked before the DB status flip.
        verify(paymentService).refundForCancellation(100L, new BigDecimal("100.00"), "Admin refund");
        // Wallet-gateway escrow → learner's wallet is credited.
        verify(walletService).addEntryForUser(eq(payment.getLearnerId()), any());
        verify(auditLogRepository).save(argThat(log ->
                log.getAction().equals("REFUND_PAYMENT")));
    }

    @Test
    void refundPaymentForExternalGatewayCreditsNoWallet() {
        // External-gateway escrow: money returns to the payer at the gateway,
        // so the wallet must NOT be credited (prevents a double refund).
        payment.setGateway("razorpay");
        payment.setPaymentId("pay_rzp_123");
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));
        Payment refunded = Payment.builder()
                .id(100L)
                .amount(new BigDecimal("100.00"))
                .currency("CREDITS")
                .status(PaymentStatus.REFUNDED)
                .learnerId(1L)
                .mentorId(2L)
                .gateway("razorpay")
                .build();
        when(paymentService.refundForCancellation(100L, new BigDecimal("100.00"), "Admin refund"))
                .thenReturn(refunded);
        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = adminService.refundPayment(admin, 100L, "Admin refund");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(paymentService).refundForCancellation(100L, new BigDecimal("100.00"), "Admin refund");
        verify(walletService, never()).addEntryForUser(anyLong(), any());
        verify(auditLogRepository).save(argThat(log ->
                log.getAction().equals("REFUND_PAYMENT")));
    }

    @Test
    void refundPaymentRejectsNonEscrowed() {
        payment.setStatus(PaymentStatus.INITIATED);
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> adminService.refundPayment(admin, 100L, "Test"));
        assertTrue(ex.getMessage().contains("Only escrowed payments can be refunded"));
    }

    @Test
    void refundPaymentPaymentNotFound() {
        when(paymentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> adminService.refundPayment(admin, 999L, "Test"));
    }

    // ── releasePayment ──────────────────────────────────

    @Test
    void releasePaymentReleasesEscrowedPayment() {
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = adminService.releasePayment(admin, 100L);

        assertEquals(PaymentStatus.RELEASED, result.getStatus());
        verify(walletService).addEntryForUser(eq(payment.getMentorId()), any());
        verify(notificationService).notifyUser(eq(payment.getMentorId()), eq("PAYOUT_RELEASED"),
                anyString(), anyString(), eq(payment.getId()));
    }

    @Test
    void releasePaymentRejectsNonEscrowed() {
        payment.setStatus(PaymentStatus.REFUNDED);
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));

        assertThrows(IllegalArgumentException.class,
                () -> adminService.releasePayment(admin, 100L));
    }

    @Test
    void releasePaymentCalculatesTenPercentFee() {
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        adminService.releasePayment(admin, 100L);

        verify(walletService).addEntryForUser(eq(payment.getMentorId()),
                argThat(req -> req.amount().compareTo(new BigDecimal("90.00")) == 0));
    }

    // ── updateNotificationPreferences ───────────────────

    @Test
    void updateNotificationPreferencesCreatesOrUpdates() {
        java.util.LinkedHashMap<String, Boolean> prefs = new java.util.LinkedHashMap<>();
        prefs.put("new_user_signups", true);
        prefs.put("daily_summary", false);

        when(adminNotifPreferenceRepository.findByPrefKey("new_user_signups")).thenReturn(Optional.empty());
        when(adminNotifPreferenceRepository.findByPrefKey("daily_summary")).thenReturn(Optional.empty());
        when(adminNotifPreferenceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        adminService.updateNotificationPreferences(prefs);

        verify(adminNotifPreferenceRepository, times(2)).save(prefCaptor.capture());
        var saved = prefCaptor.getAllValues();
        assertEquals("new_user_signups", saved.get(0).getPrefKey());
        assertTrue(saved.get(0).isPrefValue());
        assertEquals("daily_summary", saved.get(1).getPrefKey());
        assertFalse(saved.get(1).isPrefValue());
    }

    // ── broadcastNotification ───────────────────────────

    @Test
    void broadcastNotificationSendsToAllUsers() {
        User user1 = new User();
        user1.setId(1L);
        user1.setEnabled(true);
        User user2 = new User();
        user2.setId(2L);
        user2.setEnabled(true);

        when(userRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(user1, user2)));

        int sent = adminService.broadcastNotification("Title", "Message", null, "ANNOUNCEMENT");

        assertEquals(2, sent);
        verify(notificationService).notifyUsers(anyList(), eq("ANNOUNCEMENT"), eq("Title"), eq("Message"), isNull());
    }

    @Test
    void broadcastNotificationPassesCustomTypeThrough() {
        User user1 = new User();
        user1.setId(1L);
        user1.setEnabled(true);

        when(userRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(user1)));

        int sent = adminService.broadcastNotification("Downtime", "Servers down", null, "MAINTENANCE");

        assertEquals(1, sent);
        verify(notificationService).notifyUsers(anyList(), eq("MAINTENANCE"), eq("Downtime"), eq("Servers down"), isNull());
    }

    @Test
    void broadcastNotificationFiltersDisabledUsers() {
        User enabled = new User();
        enabled.setId(1L);
        enabled.setEnabled(true);
        User disabled = new User();
        disabled.setId(2L);
        disabled.setEnabled(false);

        when(userRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(enabled, disabled)));

        int sent = adminService.broadcastNotification("Update", "New release", null, "PLATFORM_UPDATE");

        assertEquals(1, sent);
        verify(notificationService).notifyUsers(argThat(ids -> ids.size() == 1), eq("PLATFORM_UPDATE"),
                eq("Update"), eq("New release"), isNull());
    }
}
