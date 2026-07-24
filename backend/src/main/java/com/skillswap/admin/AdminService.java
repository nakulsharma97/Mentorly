package com.skillswap.admin;

import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.common.ApiResponse;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.notification.NotificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.payment.PaymentService;
import com.skillswap.referral.ReferralRewardRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReport;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequest;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service layer for admin operations.
 * All transaction boundaries are defined here rather than in AdminController.
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final WalletService walletService;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final AuditLogRepository auditLogRepository;
    private final SessionRepository sessionRepository;
    private final AdminSettingRepository adminSettingRepository;
    private final AdminNotifPreferenceRepository adminNotifPreferenceRepository;
    private final ReferralRewardRepository referralRewardRepository;
    private final UserReportRepository reportRepository;
    private final MentorVerificationRequestRepository mentorVerificationRepository;

    // ════════════════════════════════════════════════
    //  Admin — User Deletion
    // ════════════════════════════════════════════════

    @Transactional
    public void deleteUser(User currentUser, Long userId, String email, String name) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setEnabled(false);
        user.setFullName("[Deleted User]");
        user.setEmail("deleted-" + user.getId() + "@skillswap.local");
        user.setPasswordHash("[DELETED]");
        user.setAboutMe(null);
        user.setSkills(null);
        user.setGithubUrl(null);
        user.setLinkedinUrl(null);
        user.setProfileImageUrl(null);
        user.setWalletAddress(null);
        userRepository.save(user);

        saveAuditLog(currentUser, "DELETE_USER", "User", userId,
                "Deleted user \"" + name + "\" (" + email + ")");
    }

    // ════════════════════════════════════════════════
    //  Admin — Notifications
    // ════════════════════════════════════════════════

    @Transactional
    public void sendTestNotification(User currentUser) {
        emailNotificationService.sendNotificationEmail(
                currentUser,
                "SkillSwap: Admin test notification",
                "This is a test notification from the SkillSwap admin panel.\n\n"
                        + "If you're receiving this, email notifications are configured correctly.\n\n"
                        + "Timestamp: " + OffsetDateTime.now());

        saveAuditLog(currentUser, "SEND_TEST_NOTIFICATION", null, null,
                "Sent test notification to " + currentUser.getEmail());
    }

    // ════════════════════════════════════════════════
    //  Admin — Report Schedule
    // ════════════════════════════════════════════════

    @Transactional
    public void updateReportSchedule(String frequency) {
        AdminSetting setting = adminSettingRepository.findBySettingKey("report_schedule_frequency")
                .orElseGet(() -> {
                    AdminSetting s = new AdminSetting();
                    s.setSettingKey("report_schedule_frequency");
                    return s;
                });
        setting.setSettingValue(frequency);
        adminSettingRepository.save(setting);
    }

    // ════════════════════════════════════════════════
    //  Admin — Payments
    // ════════════════════════════════════════════════

    @Transactional
    public Payment refundPayment(User currentUser, Long paymentId, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));

        if (payment.getStatus() != PaymentStatus.ESCROWED) {
            throw new IllegalArgumentException("Only escrowed payments can be refunded. Current status: " + payment.getStatus());
        }

        walletService.addEntryForUser(payment.getLearnerId(), new WalletService.WalletEntryRequest(
                com.skillswap.wallet.WalletTransactionType.REFUND,
                payment.getAmount(), payment.getCurrency(),
                "Admin refund: " + reason + " (payment #" + payment.getId() + ")",
                "PAYMENT", payment.getId()));

        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);
        saveAuditLog(currentUser, "REFUND_PAYMENT", "Payment", paymentId,
                "Refunded " + payment.getAmount() + ": " + reason);
        return saved;
    }

    @Transactional
    public Payment releasePayment(User currentUser, Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));

        if (payment.getStatus() != PaymentStatus.ESCROWED) {
            throw new IllegalArgumentException("Only escrowed payments can be released. Current status: " + payment.getStatus());
        }

        BigDecimal grossAmount = payment.getAmount() != null ? payment.getAmount() : BigDecimal.ZERO;
        BigDecimal platformFee = grossAmount.multiply(BigDecimal.valueOf(0.10))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal netToMentor = grossAmount.subtract(platformFee);

        walletService.addEntryForUser(payment.getMentorId(), new WalletService.WalletEntryRequest(
                com.skillswap.wallet.WalletTransactionType.EARNING,
                netToMentor, payment.getCurrency(),
                "Session payout for payment #" + payment.getId()
                        + " (" + netToMentor + " after " + platformFee + " platform fee)",
                "PAYMENT", payment.getId()));

        notificationService.notifyUser(
                payment.getMentorId(),
                "PAYOUT_RELEASED",
                "Payout released",
                "A payout has been released to your wallet.\n\n"
                        + "• Gross amount: " + grossAmount + "\n"
                        + "• Platform fee (10%): " + platformFee + "\n"
                        + "• Net amount credited: " + netToMentor + "\n\n"
                        + "You can withdraw the funds from your wallet dashboard.",
                payment.getId());

        payment.setStatus(PaymentStatus.RELEASED);
        Payment saved = paymentRepository.save(payment);

        saveAuditLog(currentUser, "RELEASE_PAYMENT", "Payment", paymentId,
                "Released " + grossAmount + " to mentor #" + payment.getMentorId()
                        + " (net: " + netToMentor + ", fee: " + platformFee + ")");
        return saved;
    }

    // ════════════════════════════════════════════════
    //  Admin — Settings
    // ════════════════════════════════════════════════

    @Transactional
    public void updateSettings(Map<String, String> settings) {
        for (Map.Entry<String, String> entry : settings.entrySet()) {
            if (entry.getValue() == null) continue;
            AdminSetting setting = adminSettingRepository.findBySettingKey(entry.getKey())
                    .orElseGet(() -> {
                        AdminSetting s = new AdminSetting();
                        s.setSettingKey(entry.getKey());
                        return s;
                    });
            setting.setSettingValue(entry.getValue());
            adminSettingRepository.save(setting);
        }
    }

    // ════════════════════════════════════════════════
    //  Admin — Notification Broadcast
    // ════════════════════════════════════════════════

    @Transactional
    public int broadcastNotification(String title, String message, String targetRole) {
        List<User> targets;
        if (targetRole != null && !targetRole.isBlank()) {
            UserRole role = UserRole.valueOf(targetRole.toUpperCase());
            targets = new java.util.ArrayList<>();
            org.springframework.data.domain.PageRequest batchReq = org.springframework.data.domain.PageRequest.of(0, 1000);
            org.springframework.data.domain.Page<User> batch;
            do {
                batch = userRepository.findByRole(role, batchReq);
                targets.addAll(batch.getContent());
                batchReq = batchReq.next();
            } while (batch.hasNext() && targets.size() < 10000);
        } else {
            targets = userRepository.findAll(org.springframework.data.domain.PageRequest.of(0, 5000)).getContent();
        }

        List<Long> enabledUserIds = targets.stream()
                .filter(User::isEnabled)
                .map(User::getId)
                .collect(Collectors.toList());

        notificationService.notifyUsers(enabledUserIds, "ANNOUNCEMENT",
                title, message, null);

        return enabledUserIds.size();
    }

    // ════════════════════════════════════════════════
    //  Admin — Bulk User Actions
    // ════════════════════════════════════════════════

    @Transactional
    public int bulkEnableUsers(List<Long> targetIds) {
        if (targetIds.isEmpty()) return 0;
        return userRepository.updateEnabledBatch(targetIds, true);
    }

    @Transactional
    public int bulkDisableUsers(List<Long> targetIds) {
        if (targetIds.isEmpty()) return 0;
        return userRepository.updateEnabledBatch(targetIds, false);
    }

    @Transactional
    public int bulkUpdateRole(List<Long> targetIds, UserRole targetRole) {
        if (targetIds.isEmpty()) return 0;
        int updated = userRepository.updateRoleBatch(targetIds, targetRole);
        if (targetRole != UserRole.MENTOR) {
            userRepository.resetMentorVerifiedBatch(targetIds);
        }
        return updated;
    }

    // ════════════════════════════════════════════════
    //  Audit helper
    // ════════════════════════════════════════════════

    @Transactional
    public void updateNotificationPreferences(Map<String, Boolean> prefs) {
        for (Map.Entry<String, Boolean> entry : prefs.entrySet()) {
            if (entry.getValue() == null) continue;
            AdminNotifPreference pref = adminNotifPreferenceRepository.findByPrefKey(entry.getKey())
                    .orElseGet(() -> {
                        AdminNotifPreference p = new AdminNotifPreference();
                        p.setPrefKey(entry.getKey());
                        return p;
                    });
            pref.setPrefValue(entry.getValue());
            adminNotifPreferenceRepository.save(pref);
        }
    }

    private void saveAuditLog(User admin, String action, String entityType, Long entityId, String details) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setAdminId(admin.getId());
            auditLog.setAdminEmail(admin.getEmail());
            auditLog.setAction(action);
            auditLog.setEntityType(entityType);
            auditLog.setEntityId(entityId);
            auditLog.setDetails(details);
            auditLogRepository.save(auditLog);
        } catch (Exception ignored) {
            log.warn("Failed to save audit log", ignored);
        }
    }
}
