package com.skillswap.admin;

import com.skillswap.common.ApiResponse;
import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReport;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequest;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletService;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.referral.ReferralReward;
import com.skillswap.referral.ReferralRewardRepository;
import com.skillswap.chat.ChatMessage;
import com.skillswap.chat.ChatMessageRepository;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.messaging.DirectMessage;
import com.skillswap.messaging.DirectMessageRepository;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.payment.PaymentService;
import com.skillswap.session.SkillSession;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SessionStatus;
import com.skillswap.notification.NotificationService;
import com.skillswap.notification.EmailNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final UserReportRepository reportRepository;
    private final MentorVerificationRequestRepository mentorVerificationRepository;
    private final WalletService walletService;
    private final BookingRepository bookingRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final DirectConversationRepository directConversationRepository;
    private final DirectMessageRepository directMessageRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final AuditLogRepository auditLogRepository;
    private final SessionRepository sessionRepository;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final AdminSettingRepository adminSettingRepository;
    private final AdminNotifPreferenceRepository adminNotifPreferenceRepository;
    private final ReferralRewardRepository referralRewardRepository;

    @GetMapping("/summary")
    public ApiResponse<AdminSummary> summary(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        long totalUsers = userRepository.count();
        long learners = userRepository.findByRole(UserRole.LEARNER).size();
        long mentors = userRepository.findByRole(UserRole.MENTOR).size();
        long admins = userRepository.findByRole(UserRole.ADMIN).size();
        long openReports = reportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.OPEN).size();
        long pendingMentorVerifications = mentorVerificationRepository
                .findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus.PENDING)
                .size();

        return new ApiResponse<>("Admin summary fetched",
                new AdminSummary(totalUsers, learners, mentors, admins, openReports, pendingMentorVerifications));
    }

    @GetMapping("/reports")
    public ApiResponse<List<UserReport>> reports(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "OPEN") ReportStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Reports fetched", reportRepository.findByStatusOrderByCreatedAtAsc(status));
    }

    @PatchMapping("/reports/{id}")
    public ApiResponse<UserReport> updateReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody ReportDecisionRequest request) {
        ensureAdmin(currentUser);

        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        report.setStatus(request.status());
        report.setUpdatedAt(OffsetDateTime.now());
        return new ApiResponse<>("Report updated", reportRepository.save(report));
    }

    @GetMapping("/mentor-verifications")
    public ApiResponse<List<MentorVerificationRequest>> mentorVerifications(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") MentorVerificationRequestStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Mentor verification queue fetched",
                mentorVerificationRepository.findByStatusOrderByCreatedAtAsc(status));
    }

    @PatchMapping("/users/{id}/enabled")
    public ApiResponse<User> setUserEnabled(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UserEnabledRequest request) {
        ensureAdmin(currentUser);

        if (currentUser.getId().equals(id)) {
            throw new IllegalArgumentException("Admins cannot disable their own account");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setEnabled(request.enabled());
        return new ApiResponse<>("User status updated", userRepository.save(user));
    }

    @PostMapping("/users/{id}/wallet-ledger")
    public ApiResponse<WalletLedgerEntry> createWalletLedgerEntry(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody WalletService.WalletEntryRequest request) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Wallet ledger entry created", walletService.addEntryForUser(id, request));
    }

    // ════════════════════════════════════════════════
    //  Admin — User Deletion (Feature 6)
    // ════════════════════════════════════════════════

    @DeleteMapping("/users/{id}")
    @Transactional
    public ApiResponse<Map<String, String>> deleteUser(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);

        if (currentUser.getId().equals(id)) {
            throw new IllegalArgumentException("Admins cannot delete their own account");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String email = user.getEmail();
        String name = user.getFullName();

        // Soft-delete: disable user and anonymize personal data to avoid
        // foreign-key constraint violations with existing bookings, messages,
        // and wallet entries. The user record stays in the database but is
        // rendered inaccessible.
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

        saveAuditLog(currentUser, "DELETE_USER", "User", id,
                "Deleted user \"" + name + "\" (" + email + ")");
        return new ApiResponse<>("User deleted", Map.of("deletedUserId", String.valueOf(id)));
    }

    // ════════════════════════════════════════════════
    //  Admin — Admin Sub-Role (Feature 3)
    // ════════════════════════════════════════════════

    @PatchMapping("/users/{id}/admin-sub-role")
    public ApiResponse<User> updateAdminSubRole(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody AdminSubRoleRequest request) {
        ensureAdmin(currentUser);

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Can only set sub-role for admin users");
        }

        user.setAdminSubRole(request.adminSubRole());
        User saved = userRepository.save(user);
        saveAuditLog(currentUser, "UPDATE_ADMIN_SUB_ROLE", "User", id,
                "Set admin sub-role to " + request.adminSubRole());
        return new ApiResponse<>("Admin sub-role updated", saved);
    }

    // ════════════════════════════════════════════════
    //  Admin — Notifications (Feature 5)
    // ════════════════════════════════════════════════

    @PostMapping("/notifications/send-test")
    @Transactional
    public ApiResponse<Map<String, String>> sendTestNotification(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        emailNotificationService.sendNotificationEmail(
                currentUser,
                "SkillSwap: Admin test notification",
                "This is a test notification from the SkillSwap admin panel.\n\n"
                        + "If you're receiving this, email notifications are configured correctly.\n\n"
                        + "Timestamp: " + OffsetDateTime.now());

        saveAuditLog(currentUser, "SEND_TEST_NOTIFICATION", null, null,
                "Sent test notification to " + currentUser.getEmail());
        return new ApiResponse<>("Test notification sent",
                Map.of("sentTo", currentUser.getEmail()));
    }

    // ════════════════════════════════════════════════
    //  Admin — Scheduled Report Config (Feature 1)
    // ════════════════════════════════════════════════

    @GetMapping("/report-schedule")
    public ApiResponse<Map<String, String>> getReportSchedule(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        String frequency = adminSettingRepository.findBySettingKey("report_schedule_frequency")
                .map(AdminSetting::getSettingValue)
                .orElse("none");
        return new ApiResponse<>("Report schedule fetched", Map.of("frequency", frequency));
    }

    @PutMapping("/report-schedule")
    @Transactional
    public ApiResponse<Map<String, String>> updateReportSchedule(
            @AuthenticationPrincipal User currentUser,
            @RequestBody Map<String, String> body) {
        ensureAdmin(currentUser);

        String frequency = body.getOrDefault("frequency", "none");
        if (!List.of("none", "weekly", "monthly").contains(frequency)) {
            throw new IllegalArgumentException("Frequency must be one of: none, weekly, monthly");
        }

        AdminSetting setting = adminSettingRepository.findBySettingKey("report_schedule_frequency")
                .orElseGet(() -> {
                    AdminSetting s = new AdminSetting();
                    s.setSettingKey("report_schedule_frequency");
                    return s;
                });
        setting.setSettingValue(frequency);
        adminSettingRepository.save(setting);

        saveAuditLog(currentUser, "UPDATE_REPORT_SCHEDULE", "Settings", null,
                "Set report schedule to " + frequency);
        return new ApiResponse<>("Report schedule updated", Map.of("frequency", frequency));
    }

    // ════════════════════════════════════════════════
    //  Admin — Messaging / Conversations
    // ════════════════════════════════════════════════

    @GetMapping("/conversations")
    public ApiResponse<List<AdminConversationDto>> listConversations(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String q) {
        ensureAdmin(currentUser);

        List<AdminConversationDto> all = new ArrayList<>();

        // Booking conversations
        if (type == null || "booking".equalsIgnoreCase(type)) {
            List<Booking> bookings = bookingRepository.findAll();
            for (Booking b : bookings) {
                if (b.getSession() == null) continue;
                ChatMessage lastMsg = chatMessageRepository.findTopByBookingIdOrderByCreatedAtDesc(b.getId());
                String participantName = b.getLearner().getFullName() + " & " + b.getSession().getMentor().getFullName();
                all.add(new AdminConversationDto(
                        "booking-" + b.getId(),
                        "booking",
                        b.getId(),
                        participantName,
                        b.getSession().getTitle(),
                        b.getBookingStatus().name(),
                        lastMsg == null ? null : lastMsg.getContent(),
                        lastMsg == null ? b.getCreatedAt() : lastMsg.getCreatedAt(),
                        b.getLearner().getId(),
                        b.getLearner().getFullName(),
                        b.getSession().getMentor().getId(),
                        b.getSession().getMentor().getFullName()));
            }
        }

        // Direct conversations
        if (type == null || "direct".equalsIgnoreCase(type)) {
            List<DirectConversation> directs = directConversationRepository.findAll();
            for (DirectConversation dc : directs) {
                DirectMessage lastMsg = directMessageRepository
                        .findTopByConversationIdOrderByCreatedAtDesc(dc.getId()).orElse(null);
                String participantName = dc.getParticipantOne().getFullName() + " & " + dc.getParticipantTwo().getFullName();
                all.add(new AdminConversationDto(
                        "direct-" + dc.getId(),
                        "direct",
                        dc.getId(),
                        participantName,
                        "Direct conversation",
                        "ACTIVE",
                        lastMsg == null ? null : lastMsg.getContent(),
                        lastMsg == null ? dc.getCreatedAt() : lastMsg.getCreatedAt(),
                        dc.getParticipantOne().getId(),
                        dc.getParticipantOne().getFullName(),
                        dc.getParticipantTwo().getId(),
                        dc.getParticipantTwo().getFullName()));
            }
        }

        all.sort((a, b) -> b.lastActivityAt().compareTo(a.lastActivityAt()));

        if (q != null && !q.isBlank()) {
            String lowered = q.toLowerCase();
            all = all.stream()
                    .filter(c -> c.participantName().toLowerCase().contains(lowered)
                            || c.sessionTitle().toLowerCase().contains(lowered)
                            || (c.lastMessagePreview() != null && c.lastMessagePreview().toLowerCase().contains(lowered)))
                    .collect(Collectors.toList());
        }

        return new ApiResponse<>("Conversations fetched", all);
    }

    @GetMapping("/conversations/booking/{bookingId}/messages")
    public ApiResponse<List<AdminMessageDto>> getBookingConversationMessages(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long bookingId) {
        ensureAdmin(currentUser);

        List<ChatMessage> messages = chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        List<AdminMessageDto> dtos = messages.stream()
                .map(m -> new AdminMessageDto(m.getId(), "booking", bookingId,
                        m.getSender().getId(), m.getSender().getFullName(), m.getSender().getEmail(),
                        m.getContent(), m.isReadByRecipient(), m.getCreatedAt()))
                .collect(Collectors.toList());

        return new ApiResponse<>("Messages fetched", dtos);
    }

    @GetMapping("/conversations/direct/{conversationId}/messages")
    public ApiResponse<List<AdminMessageDto>> getDirectConversationMessages(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long conversationId) {
        ensureAdmin(currentUser);

        List<DirectMessage> messages = directMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<AdminMessageDto> dtos = messages.stream()
                .map(m -> new AdminMessageDto(m.getId(), "direct", conversationId,
                        m.getSender().getId(), m.getSender().getFullName(), m.getSender().getEmail(),
                        m.getContent(), m.isReadByRecipient(), m.getCreatedAt()))
                .collect(Collectors.toList());

        return new ApiResponse<>("Messages fetched", dtos);
    }

    // ════════════════════════════════════════════════
    //  Admin — Payments
    // ════════════════════════════════════════════════

    @GetMapping("/payments")
    public ApiResponse<AdminPaymentDashboardDto> listPayments(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String gateway,
            @RequestParam(required = false) String q) {
        ensureAdmin(currentUser);

        List<Payment> allPayments = paymentRepository.findAll();

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalEscrowed = BigDecimal.ZERO;
        BigDecimal totalRefunded = BigDecimal.ZERO;
        BigDecimal totalReleased = BigDecimal.ZERO;
        long escrowedCount = 0;
        long refundedCount = 0;
        long failedCount = 0;

        for (Payment p : allPayments) {
            BigDecimal amt = p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO;
            switch (p.getStatus()) {
                case ESCROWED: totalEscrowed = totalEscrowed.add(amt); escrowedCount++; break;
                case RELEASED: totalReleased = totalReleased.add(amt); totalRevenue = totalRevenue.add(amt); break;
                case REFUNDED: totalRefunded = totalRefunded.add(amt); refundedCount++; break;
                case FAILED: failedCount++; break;
                default: break;
            }
        }

        BigDecimal platformFees = totalReleased.multiply(BigDecimal.valueOf(0.10))
                .setScale(2, java.math.RoundingMode.HALF_UP);

        List<AdminPaymentDto> filteredPayments = allPayments.stream()
                .filter(p -> status == null || status.isBlank() || p.getStatus().name().equalsIgnoreCase(status))
                .filter(p -> gateway == null || gateway.isBlank() || p.getGateway().equalsIgnoreCase(gateway))
                .filter(p -> {
                    if (q == null || q.isBlank()) return true;
                    String lowered = q.toLowerCase();
                    return String.valueOf(p.getId()).contains(lowered)
                            || p.getOrderId().toLowerCase().contains(lowered)
                            || (p.getPaymentId() != null && p.getPaymentId().toLowerCase().contains(lowered))
                            || p.getGateway().toLowerCase().contains(lowered)
                            || p.getStatus().name().toLowerCase().contains(lowered);
                })
                .map(p -> {
                    String learnerName = userRepository.findById(p.getLearnerId()).map(User::getFullName).orElse("Unknown");
                    String mentorName = userRepository.findById(p.getMentorId()).map(User::getFullName).orElse("Unknown");
                    return new AdminPaymentDto(p.getId(), p.getOrderId(), p.getPaymentId(),
                            p.getLearnerId(), learnerName, p.getMentorId(), mentorName, p.getSessionId(),
                            p.getAmount(), p.getCurrency(), p.getStatus().name(), p.getGateway(), p.getCreatedAt());
                })
                .sorted(Comparator.comparing(AdminPaymentDto::createdAt).reversed())
                .collect(Collectors.toList());

        AdminPaymentDashboardDto dashboard = new AdminPaymentDashboardDto(
                totalRevenue, totalEscrowed, totalRefunded, platformFees,
                escrowedCount, refundedCount, failedCount, filteredPayments);

        return new ApiResponse<>("Payments fetched", dashboard);
    }

    @PostMapping("/payments/{paymentId}/refund")
    @Transactional
    public ApiResponse<Payment> refundPayment(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long paymentId,
            @RequestBody(required = false) AdminRefundRequest request) {
        ensureAdmin(currentUser);

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));

        if (payment.getStatus() != PaymentStatus.ESCROWED) {
            throw new IllegalArgumentException("Only escrowed payments can be refunded. Current status: " + payment.getStatus());
        }

        String reason = request != null && request.reason() != null && !request.reason().isBlank()
                ? request.reason() : "Admin-initiated refund";

        walletService.addEntryForUser(payment.getLearnerId(), new WalletService.WalletEntryRequest(
                com.skillswap.wallet.WalletTransactionType.REFUND,
                payment.getAmount(), payment.getCurrency(),
                "Admin refund: " + reason + " (payment #" + payment.getId() + ")",
                "PAYMENT", payment.getId()));

        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);
        saveAuditLog(currentUser, "REFUND_PAYMENT", "Payment", paymentId,
                "Refunded " + payment.getAmount() + ": " + reason);
        return new ApiResponse<>("Payment refunded by admin", saved);
    }

    // ════════════════════════════════════════════════
    //  Admin — Users
    // ════════════════════════════════════════════════

    @GetMapping("/users")
    public ApiResponse<List<AdminUserDto>> listUsers(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        ensureAdmin(currentUser);

        List<User> allUsers = userRepository.findAll();
        List<AdminUserDto> dtos = allUsers.stream()
                .filter(u -> role == null || role.isBlank() || u.getRole().name().equalsIgnoreCase(role))
                .filter(u -> {
                    if (q == null || q.isBlank()) return true;
                    String lowered = q.toLowerCase();
                    return u.getFullName().toLowerCase().contains(lowered)
                            || u.getEmail().toLowerCase().contains(lowered)
                            || u.getRole().name().toLowerCase().contains(lowered);
                })
                .map(u -> {
                    BigDecimal walletBalance = walletService.balance(u).balance();
                    return new AdminUserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole().name(),
                            u.isMentorVerified(), u.isEnabled(), u.getSkills(), u.getCreatedAt(),
                            u.getLastActiveAt(), walletBalance, u.getAdminSubRole());
                })
                .sorted(Comparator.comparing(AdminUserDto::createdAt).reversed())
                .skip((long) page * size).limit(size)
                .collect(Collectors.toList());

        return new ApiResponse<>("Users fetched", dtos);
    }

    @PatchMapping("/users/{id}/role")
    public ApiResponse<User> updateUserRole(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody AdminRoleUpdateRequest request) {
        ensureAdmin(currentUser);

        if (currentUser.getId().equals(id)) {
            throw new IllegalArgumentException("Admins cannot change their own role");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        UserRole previousRole = user.getRole();
        user.setRole(request.role());
        if (request.role() != UserRole.MENTOR) {
            user.setMentorVerified(false);
        }
        User saved = userRepository.save(user);
        saveAuditLog(currentUser, "UPDATE_USER_ROLE", "User", id,
                "Changed role from " + previousRole + " to " + request.role());
        return new ApiResponse<>("User role updated", saved);
    }

    @GetMapping("/users/{id}/wallet")
    public ApiResponse<AdminUserWalletDto> getUserWallet(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<WalletLedgerEntry> history = walletService.history(user);
        WalletService.WalletBalance balance = walletService.balance(user);

        return new ApiResponse<>("Wallet fetched",
                new AdminUserWalletDto(user.getId(), user.getFullName(), balance.balance(), balance.currency(), history));
    }

    // ════════════════════════════════════════════════
    //  Admin — Sessions
    // ════════════════════════════════════════════════

    @GetMapping("/sessions")
    public ApiResponse<List<AdminSessionDto>> listSessions(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q) {
        ensureAdmin(currentUser);

        List<SkillSession> allSessions = sessionRepository.findAll();
        List<AdminSessionDto> dtos = allSessions.stream()
                .filter(s -> status == null || status.isBlank() || s.getStatus().name().equalsIgnoreCase(status))
                .filter(s -> {
                    if (q == null || q.isBlank()) return true;
                    String lowered = q.toLowerCase();
                    return s.getTitle().toLowerCase().contains(lowered)
                            || (s.getMentor() != null && s.getMentor().getFullName().toLowerCase().contains(lowered));
                })
                .map(s -> {
                    long participantCount = bookingRepository
                            .countBySessionIdAndBookingStatusIn(s.getId(),
                                    List.of(BookingStatus.ACCEPTED, BookingStatus.CONFIRMED,
                                            BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED));
                    return new AdminSessionDto(s.getId(), s.getTitle(),
                            s.getMentor() != null ? s.getMentor().getId() : null,
                            s.getMentor() != null ? s.getMentor().getFullName() : "Unknown",
                            s.getPriceAmount(), s.getStatus().name(), s.getSessionType(),
                            s.getStartTime(), s.getEndTime(), s.getMaxParticipants(),
                            (int) participantCount, s.getCreatedAt());
                })
                .sorted(Comparator.comparing(AdminSessionDto::createdAt).reversed())
                .collect(Collectors.toList());

        return new ApiResponse<>("Sessions fetched", dtos);
    }

    @PatchMapping("/sessions/{id}/status")
    public ApiResponse<SkillSession> updateSessionStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody AdminSessionStatusRequest request) {
        ensureAdmin(currentUser);

        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        session.setStatus(request.status());
        if (request.status() == SessionStatus.CANCELLED) {
            session.setMeetingLink(null);
        }
        SkillSession saved = sessionRepository.save(session);
        saveAuditLog(currentUser, "UPDATE_SESSION_STATUS", "Session", id,
                "Changed status to " + request.status());
        return new ApiResponse<>("Session status updated", saved);
    }

    // ════════════════════════════════════════════════
    //  Admin — Notifications Broadcast
    // ════════════════════════════════════════════════

    @PostMapping("/notifications/broadcast")
    @Transactional
    public ApiResponse<Map<String, Object>> broadcastNotification(
            @AuthenticationPrincipal User currentUser,
            @RequestBody AdminBroadcastRequest request) {
        ensureAdmin(currentUser);

        if (request.title() == null || request.title().isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (request.message() == null || request.message().isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }

        String targetRole = request.targetRole();
        List<User> targets;
        if (targetRole != null && !targetRole.isBlank()) {
            UserRole role = UserRole.valueOf(targetRole.toUpperCase());
            targets = userRepository.findByRole(role);
        } else {
            targets = userRepository.findAll();
        }

        List<Long> enabledUserIds = targets.stream()
                .filter(User::isEnabled)
                .map(User::getId)
                .collect(Collectors.toList());

        notificationService.notifyUsers(enabledUserIds, "ANNOUNCEMENT",
                request.title(), request.message(), null);

        saveAuditLog(currentUser, "BROADCAST_NOTIFICATION", null, null,
                "Sent '" + request.title() + "' to " + enabledUserIds.size()
                        + " users (role: " + (targetRole == null ? "all" : targetRole) + ")");
        return new ApiResponse<>("Broadcast sent",
                Map.of("sentCount", enabledUserIds.size(), "targetRole", targetRole == null ? "all" : targetRole));
    }

    // ════════════════════════════════════════════════
    //  Admin — Audit Log
    // ════════════════════════════════════════════════

    @GetMapping("/audit-log")
    public ApiResponse<List<AdminAuditLogDto>> getAuditLog(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String action,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        ensureAdmin(currentUser);

        List<AuditLog> logs;
        if (action != null && !action.isBlank()) {
            logs = auditLogRepository.findByActionContainingIgnoreCaseOrderByCreatedAtDesc(
                    action, PageRequest.of(page, Math.min(size, 100)));
        } else {
            logs = auditLogRepository.findAll(PageRequest.of(page, Math.min(size, 100),
                    org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")))
                    .getContent();
        }

        List<AdminAuditLogDto> dtos = logs.stream()
                .map(l -> new AdminAuditLogDto(l.getId(), l.getAdminId(), l.getAdminEmail(),
                        l.getAction(), l.getEntityType(), l.getEntityId(), l.getDetails(), l.getCreatedAt()))
                .collect(Collectors.toList());

        return new ApiResponse<>("Audit log fetched", dtos);
    }

    // ════════════════════════════════════════════════
    //  Admin — Flagged Content
    // ════════════════════════════════════════════════

    @GetMapping("/flagged-content")
    public ApiResponse<List<UserReport>> getFlaggedContent(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "OPEN") ReportStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Flagged content fetched",
                reportRepository.findByStatusOrderByCreatedAtAsc(status));
    }

    @PatchMapping("/flagged-content/{id}")
    public ApiResponse<UserReport> moderateContent(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody AdminModerationRequest request) {
        ensureAdmin(currentUser);

        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        report.setStatus(request.status());
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);

        saveAuditLog(currentUser, "MODERATE_CONTENT", "Report", id,
                "Set status to " + request.status() + ". Note: " + (request.note() == null ? "" : request.note()));
        return new ApiResponse<>("Content moderated", saved);
    }

    // ════════════════════════════════════════════════
    //  Admin — Settings (DB-backed - Feature 2)
    // ════════════════════════════════════════════════

    private Map<String, String> loadSettingsMap() {
        List<AdminSetting> allSettings = adminSettingRepository.findAll();
        Map<String, String> result = new HashMap<>();
        for (AdminSetting s : allSettings) {
            result.put(s.getSettingKey(), s.getSettingValue());
        }
        // Provide defaults for known keys
        result.putIfAbsent("platform_fee_percent", "10");
        result.putIfAbsent("min_withdrawal_amount", "10");
        result.putIfAbsent("max_session_participants", "10");
        result.putIfAbsent("maintenance_mode", "false");
        result.putIfAbsent("new_registrations_enabled", "true");
        result.putIfAbsent("mentor_verification_required", "true");
        return result;
    }

    @GetMapping("/settings")
    public ApiResponse<Map<String, String>> getSettings(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Settings fetched", loadSettingsMap());
    }

    @PutMapping("/settings")
    @Transactional
    public ApiResponse<Map<String, String>> updateSettings(
            @AuthenticationPrincipal User currentUser,
            @RequestBody Map<String, String> settings) {
        ensureAdmin(currentUser);

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

        saveAuditLog(currentUser, "UPDATE_SETTINGS", "Settings", null,
                "Updated keys: " + String.join(", ", settings.keySet()));

        return new ApiResponse<>("Settings updated", loadSettingsMap());
    }

    // ════════════════════════════════════════════════
    //  Admin — Dashboard
    // ════════════════════════════════════════════════

    @GetMapping("/dashboard")
    public ApiResponse<AdminDashboardDto> getDashboard(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false, defaultValue = "6") int months) {
        ensureAdmin(currentUser);
        months = Math.max(1, Math.min(24, months));

        OffsetDateTime now = OffsetDateTime.now();
        List<OffsetDateTime> monthList = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            monthList.add(now.minusMonths(i).withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0));
        }

        List<User> allUsers = userRepository.findAll();
        List<MonthlyBucket> signupTrend = buildMonthlyCountBuckets(monthList, allUsers.stream()
                .map(User::getCreatedAt).collect(Collectors.toList()));

        List<Payment> allPayments = paymentRepository.findAll();
        List<Payment> releasedPayments = allPayments.stream()
                .filter(p -> p.getStatus() == PaymentStatus.RELEASED)
                .collect(Collectors.toList());
        List<MonthlyBucket> revenueTrend = buildMonthlySumBuckets(monthList, releasedPayments.stream()
                .map(p -> new DatedAmount(p.getCreatedAt(),
                        p.getAmount() != null ? p.getAmount().doubleValue() : 0.0))
                .collect(Collectors.toList()));

        List<Booking> allBookings = bookingRepository.findAll();
        List<Booking> completedBookings = allBookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.COMPLETED)
                .collect(Collectors.toList());
        List<OffsetDateTime> completedDates = completedBookings.stream()
                .map(b -> b.getSession() != null && b.getSession().getStartTime() != null
                        ? b.getSession().getStartTime() : b.getCreatedAt())
                .collect(Collectors.toList());
        List<MonthlyBucket> sessionTrend = buildMonthlyCountBuckets(monthList, completedDates);

        // Platform health
        long totalUsers = userRepository.count();
        long totalMentors = userRepository.findByRole(UserRole.MENTOR).size();
        long totalLearners = userRepository.findByRole(UserRole.LEARNER).size();
        long totalBookings = bookingRepository.count();
        long completedSessionCount = bookingRepository.countByBookingStatus(BookingStatus.COMPLETED);
        double completionRate = totalBookings == 0 ? 0 : Math.round((completedSessionCount * 100.0 / totalBookings) * 10.0) / 10.0;

        OffsetDateTime weekAgo = now.minusDays(7);
        long activeUsers7d = allUsers.stream()
                .filter(u -> u.getLastActiveAt() != null && u.getLastActiveAt().isAfter(weekAgo)).count();

        double mentorRatio = totalUsers == 0 ? 0 : Math.round((totalMentors * 100.0 / totalUsers) * 10.0) / 10.0;

        OffsetDateTime todayStart = now.withHour(0).withMinute(0).withSecond(0).withNano(0);
        OffsetDateTime weekStart = now.minusDays(7).withHour(0).withMinute(0).withSecond(0).withNano(0);
        long joinedToday = allUsers.stream().filter(u -> u.getCreatedAt().isAfter(todayStart)).count();
        long joinedThisWeek = allUsers.stream().filter(u -> u.getCreatedAt().isAfter(weekStart)).count();

        double totalReleasedAmount = releasedPayments.stream()
                .mapToDouble(p -> p.getAmount() != null ? p.getAmount().doubleValue() : 0.0).sum();
        double platformFees = Math.round(totalReleasedAmount * 0.10 * 100.0) / 100.0;

        AdminDashboardDto dashboard = new AdminDashboardDto(signupTrend, revenueTrend, sessionTrend,
                new AdminHealthMetrics(totalUsers, totalMentors, totalLearners, totalBookings,
                        completedSessionCount, completionRate, activeUsers7d, mentorRatio,
                        joinedToday, joinedThisWeek, platformFees, totalReleasedAmount));

        return new ApiResponse<>("Dashboard data fetched", dashboard);
    }

    // ════════════════════════════════════════════════
    //  Admin — Referral Analytics
    // ════════════════════════════════════════════════

    @GetMapping("/referral-analytics")
    public ApiResponse<AdminReferralAnalyticsDto> getReferralAnalytics(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        List<ReferralReward> allRewards = referralRewardRepository.findAll();
        List<Long> distinctReferrerIds = referralRewardRepository.findDistinctReferrerIds();

        long totalReferrals = allRewards.size();
        long totalReferrers = distinctReferrerIds.size();
        long totalCreditsEarned = totalReferrals * 50L;

        // Users who have a referral code
        long usersWithReferralCode = userRepository.findAll().stream()
                .filter(u -> u.getReferralCode() != null)
                .count();

        double avgPerReferrer = totalReferrers > 0
                ? Math.round((double) totalReferrals / totalReferrers * 10.0) / 10.0
                : 0.0;

        long totalUsers = userRepository.count();
        double conversionRate = totalUsers > 0
                ? Math.round((double) totalReferrers / totalUsers * 100.0 * 10.0) / 10.0
                : 0.0;

        // Monthly referral trend (Java-level grouping for DB portability)
        java.util.Map<java.time.YearMonth, java.util.concurrent.atomic.AtomicLong> monthCounts = new java.util.LinkedHashMap<>();
        java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
        java.time.format.DateTimeFormatter labelFmt = java.time.format.DateTimeFormatter.ofPattern("MMM");
        // Build last 12 months as baseline using YearMonth keys to avoid year collision
        for (int i = 11; i >= 0; i--) {
            java.time.YearMonth ym = java.time.YearMonth.from(now.minusMonths(i));
            monthCounts.put(ym, new java.util.concurrent.atomic.AtomicLong(0));
        }
        for (ReferralReward reward : allRewards) {
            if (reward.getRewardedAt() == null) continue;
            java.time.YearMonth ym = java.time.YearMonth.from(reward.getRewardedAt());
            java.util.concurrent.atomic.AtomicLong counter = monthCounts.get(ym);
            if (counter != null) {
                counter.incrementAndGet();
            }
        }
        List<MonthlyBucket> referralTrend = new ArrayList<>();
        for (java.util.Map.Entry<java.time.YearMonth, java.util.concurrent.atomic.AtomicLong> entry : monthCounts.entrySet()) {
            referralTrend.add(new MonthlyBucket(labelFmt.format(entry.getKey()), entry.getValue().doubleValue()));
        }

        // Top referrers
        List<Object[]> topRaw = referralRewardRepository.findTopReferrersRaw();
        List<AdminReferrerDto> topReferrers = new ArrayList<>();
        int rank = 1;
        for (Object[] row : topRaw) {
            Long userId = ((Number) row[0]).longValue();
            long count = ((Number) row[1]).longValue();
            String name = userRepository.findById(userId)
                    .map(User::getFullName)
                    .orElse("Deleted User");
            topReferrers.add(new AdminReferrerDto(rank, userId, name, (int) count, (int) count * 50));
            rank++;
            if (rank > 10) break; // Top 10
        }

        return new ApiResponse<>("Referral analytics fetched",
                new AdminReferralAnalyticsDto(totalReferrals, totalReferrers, totalCreditsEarned,
                        avgPerReferrer, conversionRate, usersWithReferralCode,
                        referralTrend, topReferrers));
    }

    // ════════════════════════════════════════════════
    //  Admin — Notification Preferences (DB-backed - Feature 2)
    // ════════════════════════════════════════════════

    @GetMapping("/notification-preferences")
    public ApiResponse<Map<String, Boolean>> getNotificationPreferences(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        List<AdminNotifPreference> all = adminNotifPreferenceRepository.findAll();
        Map<String, Boolean> result = new HashMap<>();
        for (AdminNotifPreference p : all) {
            result.put(p.getPrefKey(), p.isPrefValue());
        }
        // Provide defaults
        result.putIfAbsent("new_user_signups", true);
        result.putIfAbsent("reports_filed", true);
        result.putIfAbsent("failed_payments", true);
        result.putIfAbsent("mentor_verifications", true);
        result.putIfAbsent("daily_summary", false);
        result.putIfAbsent("new_bookings", true);
        return new ApiResponse<>("Preferences fetched", result);
    }

    @PutMapping("/notification-preferences")
    @Transactional
    public ApiResponse<Map<String, Boolean>> updateNotificationPreferences(
            @AuthenticationPrincipal User currentUser,
            @RequestBody Map<String, Boolean> prefs) {
        ensureAdmin(currentUser);

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

        saveAuditLog(currentUser, "UPDATE_NOTIFICATION_PREFS", "Settings", null,
                "Updated notification preferences");

        List<AdminNotifPreference> all = adminNotifPreferenceRepository.findAll();
        Map<String, Boolean> result = new HashMap<>();
        for (AdminNotifPreference p : all) {
            result.put(p.getPrefKey(), p.isPrefValue());
        }
        return new ApiResponse<>("Preferences updated", result);
    }

    // ════════════════════════════════════════════════
    //  Audit helper
    // ════════════════════════════════════════════════

    private void saveAuditLog(User admin, String action, String entityType, Long entityId, String details) {
        try {
            AuditLog log = new AuditLog();
            log.setAdminId(admin.getId());
            log.setAdminEmail(admin.getEmail());
            log.setAction(action);
            log.setEntityType(entityType);
            log.setEntityId(entityId);
            log.setDetails(details);
            auditLogRepository.save(log);
        } catch (Exception ignored) {
            // Non-critical
        }
    }

    // ════════════════════════════════════════════════
    //  Admin — Health Monitoring
    // ════════════════════════════════════════════════

    @GetMapping("/health")
    public ApiResponse<AdminHealthDto> getPlatformHealth(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        Runtime rt = Runtime.getRuntime();
        long usedMemory = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long maxMemory = rt.maxMemory() / (1024 * 1024);
        double memoryUsagePercent = Math.round((usedMemory * 100.0 / Math.max(maxMemory, 1)) * 10.0) / 10.0;

        long totalUsers = userRepository.count();
        long totalBookings = bookingRepository.count();
        long pendingReports = reportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.OPEN).size();

        List<AuditLog> firstLogs = auditLogRepository.findAll(
                PageRequest.of(0, 1, org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.ASC, "createdAt")))
                .getContent();
        String uptime = firstLogs.isEmpty() ? "Unknown" : java.time.Duration.between(
                firstLogs.get(0).getCreatedAt(), OffsetDateTime.now()).toDays() + " days";

        long errorCount24h = auditLogRepository
                .findByActionContainingIgnoreCaseOrderByCreatedAtDesc("ERROR",
                        PageRequest.of(0, 100)).size();

        return new ApiResponse<>("Health data fetched", new AdminHealthDto("healthy", uptime,
                usedMemory + "MB / " + maxMemory + "MB", memoryUsagePercent,
                errorCount24h, totalUsers, totalBookings, pendingReports, OffsetDateTime.now().toString()));
    }

    // ════════════════════════════════════════════════
    //  Admin — Session Details (Feature 4 - enhanced with trend data)
    // ════════════════════════════════════════════════

    @GetMapping("/sessions/{id}/details")
    public ApiResponse<AdminSessionDetailDto> getSessionDetails(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);

        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        List<Booking> bookings = bookingRepository.findAll().stream()
                .filter(b -> b.getSession() != null && b.getSession().getId().equals(id))
                .collect(Collectors.toList());

        long totalRevenue = bookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.COMPLETED)
                .mapToLong(b -> b.getPayment() != null && b.getPayment().getAmount() != null
                        ? b.getPayment().getAmount().longValue() : 0L)
                .sum();

        double avgRating = 0.0;
        long completedCount = bookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.COMPLETED)
                .count();
        long cancelledCount = bookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.CANCELLED)
                .count();

        // Build monthly booking trend for this session
        OffsetDateTime now = OffsetDateTime.now();
        List<MonthlyBucket> bookingTrend = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            OffsetDateTime monthStart = now.minusMonths(i).withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            String label = monthStart.format(java.time.format.DateTimeFormatter.ofPattern("MMM"));
            int finalI = i;
            long count = bookings.stream()
                    .filter(b -> b.getCreatedAt() != null
                            && b.getCreatedAt().getMonthValue() == monthStart.getMonthValue()
                            && b.getCreatedAt().getYear() == monthStart.getYear())
                    .count();
            bookingTrend.add(new MonthlyBucket(label, count));
        }

        return new ApiResponse<>("Session details fetched", new AdminSessionDetailDto(
                session.getId(), session.getTitle(), session.getStatus().name(),
                session.getPriceAmount(), totalRevenue, avgRating,
                bookings.size(), bookings, completedCount, cancelledCount, bookingTrend));
    }

    // ════════════════════════════════════════════════
    //  Admin — Bulk User Actions
    // ════════════════════════════════════════════════

    @PostMapping("/users/bulk/enable")
    @Transactional
    public ApiResponse<Map<String, Object>> bulkEnableUsers(
            @AuthenticationPrincipal User currentUser,
            @RequestBody AdminBulkUserIdsRequest request) {
        ensureAdmin(currentUser);
        AtomicInteger count = new AtomicInteger(0);
        for (Long id : request.ids()) {
            if (id.equals(currentUser.getId())) continue;
            userRepository.findById(id).ifPresent(u -> {
                u.setEnabled(true);
                userRepository.save(u);
                count.incrementAndGet();
            });
        }
        saveAuditLog(currentUser, "BULK_ENABLE_USERS", "User", null, "Enabled " + count.get() + " users");
        return new ApiResponse<>("Bulk enable complete", Map.of("updatedCount", count.get()));
    }

    @PostMapping("/users/bulk/disable")
    @Transactional
    public ApiResponse<Map<String, Object>> bulkDisableUsers(
            @AuthenticationPrincipal User currentUser,
            @RequestBody AdminBulkUserIdsRequest request) {
        ensureAdmin(currentUser);
        AtomicInteger count = new AtomicInteger(0);
        for (Long id : request.ids()) {
            if (id.equals(currentUser.getId())) continue;
            userRepository.findById(id).ifPresent(u -> {
                u.setEnabled(false);
                userRepository.save(u);
                count.incrementAndGet();
            });
        }
        saveAuditLog(currentUser, "BULK_DISABLE_USERS", "User", null, "Disabled " + count.get() + " users");
        return new ApiResponse<>("Bulk disable complete", Map.of("updatedCount", count.get()));
    }

    @PostMapping("/users/bulk/role")
    @Transactional
    public ApiResponse<Map<String, Object>> bulkUpdateRole(
            @AuthenticationPrincipal User currentUser,
            @RequestBody AdminBulkRoleRequest request) {
        ensureAdmin(currentUser);
        AtomicInteger count = new AtomicInteger(0);
        UserRole targetRole = UserRole.valueOf(request.role().toUpperCase());
        for (Long id : request.ids()) {
            if (id.equals(currentUser.getId())) continue;
            userRepository.findById(id).ifPresent(u -> {
                u.setRole(targetRole);
                userRepository.save(u);
                count.incrementAndGet();
            });
        }
        saveAuditLog(currentUser, "BULK_UPDATE_ROLE", "User", null,
                "Set role to " + targetRole + " for " + count.get() + " users");
        return new ApiResponse<>("Bulk role update complete", Map.of("updatedCount", count.get()));
    }

    private static void ensureAdmin(User currentUser, AdminSubRole... requiredSubRole) {
        if (currentUser == null || currentUser.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only admins can access this area");
        }
        if (requiredSubRole.length > 0 && requiredSubRole[0] != null
                && currentUser.getAdminSubRole() != null
                && currentUser.getAdminSubRole() != requiredSubRole[0]
                && currentUser.getAdminSubRole() != AdminSubRole.SUPER_ADMIN) {
            throw new IllegalArgumentException("Insufficient permissions: " + requiredSubRole[0]
                    + " role required, but user has " + currentUser.getAdminSubRole());
        }
    }

    // ════════════════════════════════════════════════
    //  Helper methods
    // ════════════════════════════════════════════════

    private List<MonthlyBucket> buildMonthlyCountBuckets(List<OffsetDateTime> months, List<OffsetDateTime> dates) {
        Map<String, Long> counts = new java.util.LinkedHashMap<>();
        for (OffsetDateTime month : months) {
            counts.put(month.getYear() + "-" + month.getMonthValue(), 0L);
        }
        for (OffsetDateTime d : dates) {
            if (d == null) continue;
            String key = d.getYear() + "-" + d.getMonthValue();
            counts.merge(key, 1L, Long::sum);
        }
        return months.stream()
                .map(m -> new MonthlyBucket(m.format(java.time.format.DateTimeFormatter.ofPattern("MMM")),
                        counts.getOrDefault(m.getYear() + "-" + m.getMonthValue(), 0L)))
                .collect(Collectors.toList());
    }

    private List<MonthlyBucket> buildMonthlySumBuckets(List<OffsetDateTime> months, List<DatedAmount> items) {
        Map<String, Double> sums = new java.util.LinkedHashMap<>();
        for (OffsetDateTime month : months) {
            sums.put(month.getYear() + "-" + month.getMonthValue(), 0.0);
        }
        for (DatedAmount item : items) {
            if (item.date() == null) continue;
            String key = item.date().getYear() + "-" + item.date().getMonthValue();
            sums.merge(key, item.amount(), Double::sum);
        }
        return months.stream()
                .map(m -> new MonthlyBucket(m.format(java.time.format.DateTimeFormatter.ofPattern("MMM")),
                        Math.round(sums.getOrDefault(m.getYear() + "-" + m.getMonthValue(), 0.0) * 100.0) / 100.0))
                .collect(Collectors.toList());
    }

    private record DatedAmount(OffsetDateTime date, double amount) {}
    public record MonthlyBucket(String label, double value) {}

    public record AdminDashboardDto(
            List<MonthlyBucket> signupTrend, List<MonthlyBucket> revenueTrend,
            List<MonthlyBucket> sessionTrend, AdminHealthMetrics health) {}

    public record AdminHealthMetrics(long totalUsers, long totalMentors, long totalLearners,
            long totalBookings, long completedSessions, double completionRate,
            long activeUsers7d, double mentorRatio, long joinedToday, long joinedThisWeek,
            double platformFees, double totalReleasedAmount) {}

    public record AdminSummary(long totalUsers, long learners, long mentors, long admins,
            long openReports, long pendingMentorVerifications) {}
    public record ReportDecisionRequest(ReportStatus status) {}
    public record UserEnabledRequest(boolean enabled) {}
    public record AdminSubRoleRequest(AdminSubRole adminSubRole) {}

    // Conversation DTOs
    public record AdminConversationDto(String id, String kind, Long referenceId, String participantName,
            String sessionTitle, String status, String lastMessagePreview, OffsetDateTime lastActivityAt,
            Long participantOneId, String participantOneName, Long participantTwoId, String participantTwoName) {}
    public record AdminMessageDto(Long id, String kind, Long conversationRefId, Long senderId,
            String senderName, String senderEmail, String content, boolean readByRecipient, OffsetDateTime createdAt) {}

    // Payment DTOs
    public record AdminPaymentDashboardDto(BigDecimal totalRevenue, BigDecimal totalEscrowed,
            BigDecimal totalRefunded, BigDecimal platformFees, long escrowedCount, long refundedCount,
            long failedCount, List<AdminPaymentDto> payments) {}
    public record AdminPaymentDto(Long id, String orderId, String paymentId, Long learnerId, String learnerName,
            Long mentorId, String mentorName, Long sessionId, BigDecimal amount, String currency,
            String status, String gateway, OffsetDateTime createdAt) {}
    public record AdminRefundRequest(String reason) {}

    // User DTOs
    public record AdminUserDto(Long id, String email, String fullName, String role, boolean mentorVerified,
            boolean enabled, String skills, OffsetDateTime createdAt, OffsetDateTime lastActiveAt,
            BigDecimal walletBalance, AdminSubRole adminSubRole) {}
    public record AdminRoleUpdateRequest(UserRole role) {}
    public record AdminUserWalletDto(Long userId, String userName, BigDecimal balance,
            String currency, List<WalletLedgerEntry> history) {}

    // Session DTOs
    public record AdminSessionDto(Long id, String title, Long mentorId, String mentorName, BigDecimal priceAmount,
            String status, String sessionType, OffsetDateTime startTime, OffsetDateTime endTime,
            Integer maxParticipants, int participantCount, OffsetDateTime createdAt) {}
    public record AdminSessionStatusRequest(SessionStatus status) {}

    // Notification DTOs
    public record AdminBroadcastRequest(String title, String message, String targetRole) {}

    // Audit Log DTOs
    public record AdminAuditLogDto(Long id, Long adminId, String adminEmail, String action,
            String entityType, Long entityId, String details, OffsetDateTime createdAt) {}

    // Moderation DTOs
    public record AdminModerationRequest(ReportStatus status, String note) {}

    // Health DTOs
    public record AdminHealthDto(String status, String uptime, String memoryUsage, double memoryUsagePercent,
            long errors24h, long totalUsers, long totalBookings, long pendingReports, String serverTime) {}

    // Session Detail DTOs (enhanced with completed/cancelled counts + monthly trend)
    public record AdminSessionDetailDto(Long sessionId, String title, String status, BigDecimal price,
            long totalRevenue, double averageRating, int totalBookings, List<Booking> bookings,
            long completedCount, long cancelledCount, List<MonthlyBucket> bookingTrend) {}

    // Bulk Action DTOs
    public record AdminBulkUserIdsRequest(List<Long> ids) {}
    public record AdminBulkRoleRequest(List<Long> ids, String role) {}

    // Referral Analytics DTOs
    public record AdminReferralAnalyticsDto(
            long totalReferrals, long totalReferrers, long totalCreditsEarned,
            double avgPerReferrer, double conversionRate, long usersWithReferralCode,
            List<MonthlyBucket> referralTrend, List<AdminReferrerDto> topReferrers) {}

    public record AdminReferrerDto(
            int rank, Long userId, String name, int referralCount, int creditsEarned) {}
}
