package com.skillswap.admin;

import com.skillswap.common.AdminUtils;
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
import com.skillswap.review.MentorReview;
import com.skillswap.review.MentorReviewRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    /** Logger instance. */
    private static final Logger LOG = LoggerFactory.getLogger(AdminController.class);

    private final UserRepository userRepository;
    private final UserReportRepository reportRepository;
    private final MentorVerificationRequestRepository
            mentorVerificationRepository;
    private final WalletService walletService;
    private final BookingRepository bookingRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final DirectConversationRepository
            directConversationRepository;
    private final DirectMessageRepository directMessageRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final AuditLogRepository auditLogRepository;
    private final SessionRepository sessionRepository;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final AdminSettingRepository adminSettingRepository;
    private final AdminNotifPreferenceRepository
            adminNotifPreferenceRepository;
    private final ReferralRewardRepository referralRewardRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final AdminService adminService;
    private final CertMigrationService certMigrationService;

    @GetMapping("/summary")
    public ApiResponse<AdminSummary> summary(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        long totalUsers = userRepository.count();
        long learners = userRepository.countByRole(UserRole.LEARNER);
        long mentors = userRepository.countByRole(UserRole.MENTOR);
        long admins = userRepository.countByRole(UserRole.ADMIN);
        long openReports = reportRepository.countByStatus(ReportStatus.OPEN);
        long pendingMentorVerifications = mentorVerificationRepository.countByStatus(MentorVerificationRequestStatus.PENDING);

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
            @Valid @RequestBody ReportDecisionRequest request) {
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

        adminService.deleteUser(currentUser, id, email, name);
        return new ApiResponse<>("User deleted", Map.of("deletedUserId", String.valueOf(id)));
    }

    // ════════════════════════════════════════════════
    //  Admin — Admin Sub-Role (Feature 3)
    // ════════════════════════════════════════════════

    @PatchMapping("/users/{id}/admin-sub-role")
    public ApiResponse<User> updateAdminSubRole(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody AdminSubRoleRequest request) {
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
    public ApiResponse<Map<String, String>> sendTestNotification(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        adminService.sendTestNotification(currentUser);
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
    public ApiResponse<Map<String, String>> updateReportSchedule(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminReportScheduleRequest request) {
        ensureAdmin(currentUser);

        String frequency = request.frequency();
        adminService.updateReportSchedule(frequency);

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

        // ── Booking conversations (batch-fetch last messages instead of N+1) ──
        if (type == null || "booking".equalsIgnoreCase(type)) {
            List<Booking> bookings = bookingRepository
                    .findAll(PageRequest.of(0, 500)).getContent();

            // Collect all booking IDs that have sessions
            List<Long> bookingIds = new ArrayList<>();
            for (Booking b : bookings) {
                if (b.getSession() != null) {
                    bookingIds.add(b.getId());
                }
            }

            // Batch-fetch the last message for ALL booking IDs in 1 query
            Map<Long, ChatMessage> lastMsgByBookingId = new HashMap<>();
            if (!bookingIds.isEmpty()) {
                List<ChatMessage> lastMessages = chatMessageRepository
                        .findLastMessagesByBookingIds(bookingIds);
                for (ChatMessage msg : lastMessages) {
                    lastMsgByBookingId.put(msg.getBooking().getId(), msg);
                }
            }

            // Build DTOs using the lookup map (no individual queries per booking)
            for (Booking b : bookings) {
                if (b.getSession() == null) continue;
                ChatMessage lastMsg = lastMsgByBookingId.get(b.getId());
                String participantName = b.getLearner().getFullName()
                        + " & " + b.getSession().getMentor().getFullName();
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
                        b.getLearner().getUsername(),
                        b.getSession().getMentor().getId(),
                        b.getSession().getMentor().getFullName(),
                        b.getSession().getMentor().getUsername()));
            }
        }

        // ── Direct conversations (same batch pattern) ──
        if (type == null || "direct".equalsIgnoreCase(type)) {
            List<DirectConversation> directs = directConversationRepository
                    .findAll(PageRequest.of(0, 500)).getContent();

            // Collect all conversation IDs
            List<Long> convIds = directs.stream()
                    .map(DirectConversation::getId)
                    .collect(Collectors.toList());

            // Batch-fetch the last message for ALL conversations in 1 query
            Map<Long, DirectMessage> lastMsgByConvId = new HashMap<>();
            if (!convIds.isEmpty()) {
                List<DirectMessage> lastMessages = directMessageRepository
                        .findLastMessagesByConversationIds(convIds);
                for (DirectMessage msg : lastMessages) {
                    if (msg.getConversation() != null) {
                        lastMsgByConvId.put(msg.getConversation().getId(), msg);
                    }
                }
            }

            // Build DTOs using the lookup map
            for (DirectConversation dc : directs) {
                DirectMessage lastMsg = lastMsgByConvId.get(dc.getId());
                String participantName = dc.getParticipantOne().getFullName()
                        + " & " + dc.getParticipantTwo().getFullName();
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
                        dc.getParticipantOne().getUsername(),
                        dc.getParticipantTwo().getId(),
                        dc.getParticipantTwo().getFullName(),
                        dc.getParticipantTwo().getUsername()));
            }
        }

        // Sort by most recent activity
        all.sort((a, b) -> b.lastActivityAt().compareTo(a.lastActivityAt()));

        // Filter by search query
        if (q != null && !q.isBlank()) {
            String lowered = q.toLowerCase();
            all = all.stream()
                    .filter(c -> c.participantName().toLowerCase().contains(lowered)
                            || c.sessionTitle().toLowerCase().contains(lowered)
                            || (c.lastMessagePreview() != null
                                    && c.lastMessagePreview().toLowerCase().contains(lowered)))
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
                        m.getSender().getId(), m.getSender().getFullName(), m.getSender().getUsername(), m.getSender().getEmail(),
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
                        m.getSender().getId(), m.getSender().getFullName(), m.getSender().getUsername(), m.getSender().getEmail(),
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
            @RequestParam(required = false) String q,
            Pageable pageable) {
        ensureAdmin(currentUser);

        // Compute aggregates from all payments with a single query
        List<Object[]> aggregates = paymentRepository.computeAggregates();
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalEscrowed = BigDecimal.ZERO;
        BigDecimal totalRefunded = BigDecimal.ZERO;
        BigDecimal totalReleased = BigDecimal.ZERO;
        long escrowedCount = 0;
        long refundedCount = 0;
        long failedCount = 0;

        for (Object[] row : aggregates) {
            PaymentStatus aggStatus = (PaymentStatus) row[0];
            BigDecimal aggAmount = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            long aggCount = ((Number) row[2]).longValue();
            switch (aggStatus) {
                case ESCROWED: totalEscrowed = totalEscrowed.add(aggAmount); escrowedCount = aggCount; break;
                case RELEASED: totalReleased = totalReleased.add(aggAmount); totalRevenue = totalRevenue.add(aggAmount); break;
                case REFUNDED: totalRefunded = totalRefunded.add(aggAmount); refundedCount = aggCount; break;
                case FAILED: failedCount = aggCount; break;
                default: break;
            }
        }

        BigDecimal platformFees = totalReleased.multiply(BigDecimal.valueOf(0.10))
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // Paginated payment list from DB - batch-fetch user names (N+1 → 2 queries)
        Page<Payment> paymentPage = paymentRepository.findByFilters(status, gateway, q, pageable);
        List<Long> userIdsToFetch = new ArrayList<>();
        for (Payment p : paymentPage.getContent()) {
            userIdsToFetch.add(p.getLearnerId());
            userIdsToFetch.add(p.getMentorId());
        }
        Map<Long, String> userNameMap = new HashMap<>();
        Map<Long, String> userUsernameMap = new HashMap<>();
        if (!userIdsToFetch.isEmpty()) {
            userRepository.findAllById(userIdsToFetch).forEach(
                    u -> {
                        userNameMap.put(u.getId(), u.getFullName());
                        userUsernameMap.put(u.getId(), u.getUsername());
                    });
        }

        List<AdminPaymentDto> filteredPayments = paymentPage.getContent().stream()
                .map(p -> {
                    String learnerName = userNameMap.getOrDefault(p.getLearnerId(), "Unknown");
                    String learnerUsername = userUsernameMap.getOrDefault(p.getLearnerId(), "");
                    String mentorName = userNameMap.getOrDefault(p.getMentorId(), "Unknown");
                    String mentorUsername = userUsernameMap.getOrDefault(p.getMentorId(), "");
                    return new AdminPaymentDto(p.getId(), p.getOrderId(), p.getPaymentId(),
                            p.getLearnerId(), learnerName, learnerUsername, p.getMentorId(), mentorName, mentorUsername, p.getSessionId(),
                            p.getAmount(), p.getCurrency(), p.getStatus().name(), p.getGateway(), p.getCreatedAt());
                })
                .sorted(Comparator.comparing(AdminPaymentDto::createdAt).reversed())
                .collect(Collectors.toList());

        AdminPaymentDashboardDto dashboard = new AdminPaymentDashboardDto(
                totalRevenue, totalEscrowed, totalRefunded, platformFees,
                escrowedCount, refundedCount, failedCount, filteredPayments,
                (int) paymentPage.getTotalElements(), paymentPage.getTotalPages());

        return new ApiResponse<>("Payments fetched", dashboard);
    }

    @PostMapping("/payments/{paymentId}/refund")
    public ApiResponse<Payment> refundPayment(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long paymentId,
            @RequestBody(required = false) AdminRefundRequest request) {
        ensureAdmin(currentUser);

        String reason = request != null && request.reason() != null && !request.reason().isBlank()
                ? request.reason() : "Admin-initiated refund";

        Payment saved = adminService.refundPayment(currentUser, paymentId, reason);
        return new ApiResponse<>("Payment refunded by admin", saved);
    }

    @PostMapping("/payments/{paymentId}/release")
    public ApiResponse<Payment> releasePayment(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long paymentId) {
        ensureAdmin(currentUser);

        Payment saved = adminService.releasePayment(currentUser, paymentId);
        return new ApiResponse<>("Payment released to mentor", saved);
    }

    // ════════════════════════════════════════════════
    //  Admin — Users
    // ════════════════════════════════════════════════

    @GetMapping("/users")
    public ApiResponse<Page<AdminUserDto>> listUsers(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        ensureAdmin(currentUser);

        UserRole roleFilter = (role != null && !role.isBlank()) ? UserRole.valueOf(role.toUpperCase()) : null;
        Page<User> userPage = userRepository.findByFilters(roleFilter, q, pageable);

        Page<AdminUserDto> dtoPage = userPage.map(u -> {
            BigDecimal walletBalance = walletService.balance(u).balance();
            return new AdminUserDto(u.getId(), u.getEmail(), u.getFullName(), u.getUsername(), u.getRole().name(),
                    u.isMentorVerified(), u.isEnabled(), u.getSkills(), u.getCreatedAt(),
                    u.getLastActiveAt(), walletBalance, u.getAdminSubRole());
        });

        return new ApiResponse<>("Users fetched", dtoPage);
    }

    @PatchMapping("/users/{id}/role")
    public ApiResponse<User> updateUserRole(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody AdminRoleUpdateRequest request) {
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
                new AdminUserWalletDto(user.getId(), user.getFullName(), user.getUsername(), balance.balance(), balance.currency(), history));
    }

    // ════════════════════════════════════════════════
    //  Admin — Sessions
    // ════════════════════════════════════════════════

    @GetMapping("/sessions")
    public ApiResponse<Page<AdminSessionDto>> listSessions(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        ensureAdmin(currentUser);

        SessionStatus statusFilter = (status != null && !status.isBlank()) ? SessionStatus.valueOf(status.toUpperCase()) : null;
        Page<SkillSession> sessionPage = sessionRepository.findByFilters(statusFilter, q, pageable);

        Page<AdminSessionDto> dtoPage = sessionPage.map(s -> {
            long participantCount = bookingRepository
                    .countBySessionIdAndBookingStatusIn(s.getId(),
                            List.of(BookingStatus.ACCEPTED, BookingStatus.CONFIRMED,
                                    BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED));
            return new AdminSessionDto(s.getId(), s.getTitle(),
                    s.getMentor() != null ? s.getMentor().getId() : null,
                    s.getMentor() != null ? s.getMentor().getFullName() : "Unknown",
                    s.getMentor() != null ? s.getMentor().getUsername() : null,
                    s.getPriceAmount(), s.getStatus().name(), s.getSessionType(),
                    s.getStartTime(), s.getEndTime(), s.getMaxParticipants(),
                    (int) participantCount, s.getCreatedAt());
        });

        return new ApiResponse<>("Sessions fetched", dtoPage);
    }

    @PatchMapping("/sessions/{id}/status")
    public ApiResponse<SkillSession> updateSessionStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody AdminSessionStatusRequest request) {
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
    public ApiResponse<Map<String, Object>> broadcastNotification(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminBroadcastRequest request) {
        ensureAdmin(currentUser);

        if (request.title() == null || request.title().isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (request.message() == null || request.message().isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }

        String targetRole = request.targetRole();
        int sentCount = adminService.broadcastNotification(request.title(), request.message(), targetRole);

        saveAuditLog(currentUser, "BROADCAST_NOTIFICATION", null, null,
                "Sent '" + request.title() + "' to " + sentCount
                        + " users (role: " + (targetRole == null ? "all" : targetRole) + ")");
        return new ApiResponse<>("Broadcast sent",
                Map.of("sentCount", sentCount, "targetRole", targetRole == null ? "all" : targetRole));
    }

    // ════════════════════════════════════════════════
    //  Admin — Audit Log
    // ════════════════════════════════════════════════

    @GetMapping("/audit-log")
    public ApiResponse<Page<AdminAuditLogDto>> getAuditLog(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String action,
            Pageable pageable) {
        ensureAdmin(currentUser);

        Page<AuditLog> logPage;
        if (action != null && !action.isBlank()) {
            List<AuditLog> logs = auditLogRepository.findByActionContainingIgnoreCaseOrderByCreatedAtDesc(
                    action, PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100)));
            // Wrap in a Page for consistent API response
            long total = auditLogRepository.countByActionContainingIgnoreCase(action);
            logPage = new PageImpl<>(logs, pageable, total);
        } else {
            logPage = auditLogRepository.findAll(PageRequest.of(pageable.getPageNumber(),
                    Math.min(pageable.getPageSize(), 100),
                    org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")));
        }

        Page<AdminAuditLogDto> dtoPage = logPage.map(l -> new AdminAuditLogDto(l.getId(), l.getAdminId(), l.getAdminEmail(),
                l.getAction(), l.getEntityType(), l.getEntityId(), l.getDetails(), l.getCreatedAt()));

        return new ApiResponse<>("Audit log fetched", dtoPage);
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
            @Valid @RequestBody AdminModerationRequest request) {
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
    public ApiResponse<Map<String, String>> updateSettings(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminSettingsDto request) {
        ensureAdmin(currentUser);

        Map<String, String> settings = request.settings();
        if (settings == null || settings.isEmpty()) {
            throw new IllegalArgumentException("At least one setting is required");
        }

        adminService.updateSettings(settings);

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

        // Use aggregate queries instead of loading entire tables into memory
        long totalUsers = userRepository.count();
        long totalMentors = userRepository.countByRole(UserRole.MENTOR);
        long totalLearners = userRepository.countByRole(UserRole.LEARNER);
        long totalBookings = bookingRepository.count();
        long completedSessionCount = bookingRepository.countByBookingStatus(BookingStatus.COMPLETED);
        double completionRate = totalBookings == 0 ? 0 : Math.round((completedSessionCount * 100.0 / totalBookings) * 10.0) / 10.0;

        OffsetDateTime weekAgo = now.minusDays(7);
        OffsetDateTime todayStart = now.withHour(0).withMinute(0).withSecond(0).withNano(0);
        OffsetDateTime weekStart = now.minusDays(7).withHour(0).withMinute(0).withSecond(0).withNano(0);

        long activeUsers7d = userRepository.countByLastActiveAtAfter(weekAgo);
        long joinedToday = userRepository.countByCreatedAtAfter(todayStart);
        long joinedThisWeek = userRepository.countByCreatedAtAfter(weekStart);
        double mentorRatio = totalUsers == 0 ? 0 : Math.round((totalMentors * 100.0 / totalUsers) * 10.0) / 10.0;

        // Monthly trends via aggregate queries (batched)
        List<Object[]> signupCountsPerMonth = paymentRepository.computeMonthlySignupTrend(monthList.get(0));
        List<Object[]> revenuePerMonth = paymentRepository.computeMonthlyRevenueTrend(monthList.get(0));
        List<Object[]> completedBookingsPerMonth = paymentRepository.computeMonthlySessionTrend(monthList.get(0));

        Map<Integer, Long> signupMonthMap = new HashMap<>();
        for (Object[] row : signupCountsPerMonth) {
            signupMonthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        List<MonthlyBucket> signupTrend = buildMonthlyCountBucketsFromMap(monthList, signupMonthMap);

        Map<Integer, Double> revenueMonthMap = new HashMap<>();
        for (Object[] row : revenuePerMonth) {
            revenueMonthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).doubleValue());
        }
        List<MonthlyBucket> revenueTrend = buildMonthlySumBucketsFromMap(monthList, revenueMonthMap);
        double totalReleasedAmount = revenueMonthMap.values().stream().mapToDouble(Double::doubleValue).sum();

        Map<Integer, Long> sessionMonthMap = new HashMap<>();
        for (Object[] row : completedBookingsPerMonth) {
            sessionMonthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        List<MonthlyBucket> sessionTrend = buildMonthlyCountBucketsFromMap(monthList, sessionMonthMap);

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

        List<Long> distinctReferrerIds = referralRewardRepository.findDistinctReferrerIds();
        long totalReferrals = referralRewardRepository.count();
        long totalReferrers = distinctReferrerIds.size();
        long totalCreditsEarned = totalReferrals * 50L;

        // Users who have a referral code
        long usersWithReferralCode = userRepository.countByReferralCodeIsNotNull();

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
        List<Object[]> monthlyRaw = referralRewardRepository.countByMonth();
        for (Object[] row : monthlyRaw) {
            int year = ((Number) row[0]).intValue();
            int month = ((Number) row[1]).intValue();
            long count = ((Number) row[2]).longValue();
            java.time.YearMonth ym = java.time.YearMonth.of(year, month);
            java.util.concurrent.atomic.AtomicLong counter = monthCounts.get(ym);
            if (counter != null) {
                counter.addAndGet(count);
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
            User referrerUser = userRepository.findById(userId).orElse(null);
            String name = referrerUser != null ? referrerUser.getFullName() : "Deleted User";
            String username = referrerUser != null ? referrerUser.getUsername() : "";
            topReferrers.add(new AdminReferrerDto(rank, userId, name, username, (int) count, (int) count * 50));
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
    public ApiResponse<Map<String, Boolean>> updateNotificationPreferences(
            @AuthenticationPrincipal User currentUser,
            @RequestBody Map<String, Boolean> prefs) {
        ensureAdmin(currentUser);

        adminService.updateNotificationPreferences(prefs);
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
            LOG.warn("Failed to save audit log", ignored);
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
        long pendingReports = reportRepository.countByStatus(ReportStatus.OPEN);

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

        List<Booking> bookings = bookingRepository.findBySessionId(id);

        long totalRevenue = bookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.COMPLETED)
                .mapToLong(b -> b.getPayment() != null && b.getPayment().getAmount() != null
                        ? b.getPayment().getAmount().longValue() : 0L)
                .sum();

        // Compute average rating from reviews linked to this session's bookings
        double avgRating = bookings.stream()
                .filter(b -> b.getBookingStatus() == BookingStatus.COMPLETED)
                .flatMap(b -> {
                    var reviewOpt = mentorReviewRepository.findByBookingId(b.getId());
                    return reviewOpt.isPresent() ? java.util.stream.Stream.of(reviewOpt.get()) : java.util.stream.Stream.empty();
                })
                .mapToInt(MentorReview::getRating)
                .average()
                .orElse(0.0);

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
    public ApiResponse<Map<String, Object>> bulkEnableUsers(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminBulkUserIdsRequest request) {
        ensureAdmin(currentUser);
        List<Long> targets = request.ids().stream()
                .filter(id -> !id.equals(currentUser.getId()))
                .collect(Collectors.toList());
        int updated = adminService.bulkEnableUsers(targets);
        saveAuditLog(currentUser, "BULK_ENABLE_USERS", "User", null, "Enabled " + updated + " users");
        return new ApiResponse<>("Bulk enable complete", Map.of("updatedCount", updated));
    }

    @PostMapping("/users/bulk/disable")
    public ApiResponse<Map<String, Object>> bulkDisableUsers(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminBulkUserIdsRequest request) {
        ensureAdmin(currentUser);
        List<Long> targets = request.ids().stream()
                .filter(id -> !id.equals(currentUser.getId()))
                .collect(Collectors.toList());
        int updated = adminService.bulkDisableUsers(targets);
        saveAuditLog(currentUser, "BULK_DISABLE_USERS", "User", null, "Disabled " + updated + " users");
        return new ApiResponse<>("Bulk disable complete", Map.of("updatedCount", updated));
    }

    @PostMapping("/users/bulk/role")
    public ApiResponse<Map<String, Object>> bulkUpdateRole(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminBulkRoleRequest request) {
        ensureAdmin(currentUser);
        List<Long> targets = request.ids().stream()
                .filter(id -> !id.equals(currentUser.getId()))
                .collect(Collectors.toList());
        UserRole targetRole = UserRole.valueOf(request.role().toUpperCase());
        int updated = adminService.bulkUpdateRole(targets, targetRole);
        saveAuditLog(currentUser, "BULK_UPDATE_ROLE", "User", null,
                "Set role to " + targetRole + " for " + updated + " users");
        return new ApiResponse<>("Bulk role update complete", Map.of("updatedCount", updated));
    }

    // ════════════════════════════════════════════════
    //  Admin — Migration: User.certificates text → MentorCertification entities
    // ════════════════════════════════════════════════

    @PostMapping("/migrations/certificates-to-structured")
    public ApiResponse<CertMigrationService.MigrationResult> migrateCertificatesToStructured(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        CertMigrationService.MigrationResult result = certMigrationService.migrateAll();
        saveAuditLog(currentUser, "MIGRATE_CERTIFICATES", null, null,
                "Migrated " + result.certsCreated() + " certs for " + result.usersProcessed() + " users");
        return new ApiResponse<>("Migration complete", result);
    }

    private static void ensureAdmin(User currentUser, AdminSubRole... requiredSubRole) {
        AdminUtils.ensureAdmin(currentUser, requiredSubRole);
    }

    // ════════════════════════════════════════════════
    //  Helper methods
    // ════════════════════════════════════════════════

    private List<MonthlyBucket> buildMonthlyCountBucketsFromMap(List<OffsetDateTime> months, Map<Integer, Long> monthMap) {
        return months.stream().map(m -> {
            int key = m.getYear() * 100 + m.getMonthValue();
            return new MonthlyBucket(m.format(java.time.format.DateTimeFormatter.ofPattern("MMM")),
                    monthMap.getOrDefault(key, 0L));
        }).collect(Collectors.toList());
    }

    private List<MonthlyBucket> buildMonthlySumBucketsFromMap(List<OffsetDateTime> months, Map<Integer, Double> monthMap) {
        return months.stream().map(m -> {
            int key = m.getYear() * 100 + m.getMonthValue();
            return new MonthlyBucket(m.format(java.time.format.DateTimeFormatter.ofPattern("MMM")),
                    Math.round(monthMap.getOrDefault(key, 0.0) * 100.0) / 100.0);
        }).collect(Collectors.toList());
    }

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
    public record ReportDecisionRequest(@NotNull ReportStatus status) {}
    public record UserEnabledRequest(boolean enabled) {}
    public record AdminSubRoleRequest(@NotNull AdminSubRole adminSubRole) {}
    public record AdminSettingsDto(java.util.Map<String, String> settings) {}
    public record AdminReportScheduleRequest(@NotBlank @jakarta.validation.constraints.Pattern(regexp = "^(none|weekly|monthly)$", message = "Frequency must be none, weekly, or monthly") String frequency) {}

    // Conversation DTOs
    public record AdminConversationDto(String id, String kind, Long referenceId, String participantName,
            String sessionTitle, String status, String lastMessagePreview, OffsetDateTime lastActivityAt,
            Long participantOneId, String participantOneName, String participantOneUsername,
            Long participantTwoId, String participantTwoName, String participantTwoUsername) {}
    public record AdminMessageDto(Long id, String kind, Long conversationRefId, Long senderId,
            String senderName, String senderUsername, String senderEmail,
            String content, boolean readByRecipient, OffsetDateTime createdAt) {}

    // Payment DTOs
    public record AdminPaymentDashboardDto(BigDecimal totalRevenue, BigDecimal totalEscrowed,
            BigDecimal totalRefunded, BigDecimal platformFees, long escrowedCount, long refundedCount,
            long failedCount, List<AdminPaymentDto> payments,
            int totalElements, int totalPages) {}
    public record AdminPaymentDto(Long id, String orderId, String paymentId, Long learnerId, String learnerName,
            String learnerUsername, Long mentorId, String mentorName, String mentorUsername,
            Long sessionId, BigDecimal amount, String currency,
            String status, String gateway, OffsetDateTime createdAt) {}
    public record AdminRefundRequest(String reason) {}

    // User DTOs
    public record AdminUserDto(Long id, String email, String fullName, String username, String role, boolean mentorVerified,
            boolean enabled, String skills, OffsetDateTime createdAt, OffsetDateTime lastActiveAt,
            BigDecimal walletBalance, AdminSubRole adminSubRole) {}
    public record AdminRoleUpdateRequest(@NotNull UserRole role) {}
    public record AdminUserWalletDto(Long userId, String userName, String username, BigDecimal balance,
            String currency, List<WalletLedgerEntry> history) {}

    // Session DTOs
    public record AdminSessionDto(Long id, String title, Long mentorId, String mentorName, String mentorUsername,
            BigDecimal priceAmount, String status, String sessionType, OffsetDateTime startTime, OffsetDateTime endTime,
            Integer maxParticipants, int participantCount, OffsetDateTime createdAt) {}
    public record AdminSessionStatusRequest(@NotNull SessionStatus status) {}

    // Notification DTOs
    public record AdminBroadcastRequest(@NotBlank String title, @NotBlank String message, String targetRole) {}

    // Audit Log DTOs
    public record AdminAuditLogDto(Long id, Long adminId, String adminEmail, String action,
            String entityType, Long entityId, String details, OffsetDateTime createdAt) {}

    // Moderation DTOs
    public record AdminModerationRequest(@NotNull ReportStatus status, String note) {}

    // Health DTOs
    public record AdminHealthDto(String status, String uptime, String memoryUsage, double memoryUsagePercent,
            long errors24h, long totalUsers, long totalBookings, long pendingReports, String serverTime) {}

    // Session Detail DTOs (enhanced with completed/cancelled counts + monthly trend)
    public record AdminSessionDetailDto(Long sessionId, String title, String status, BigDecimal price,
            long totalRevenue, double averageRating, int totalBookings, List<Booking> bookings,
            long completedCount, long cancelledCount, List<MonthlyBucket> bookingTrend) {}

    // Bulk Action DTOs
    public record AdminBulkUserIdsRequest(@jakarta.validation.constraints.NotEmpty List<Long> ids) {}
    public record AdminBulkRoleRequest(@jakarta.validation.constraints.NotEmpty List<Long> ids, @NotBlank String role) {}

    // Referral Analytics DTOs
    public record AdminReferralAnalyticsDto(
            long totalReferrals, long totalReferrers, long totalCreditsEarned,
            double avgPerReferrer, double conversionRate, long usersWithReferralCode,
            List<MonthlyBucket> referralTrend, List<AdminReferrerDto> topReferrers) {}

    public record AdminReferrerDto(
            int rank, Long userId, String name, String username, int referralCount, int creditsEarned) {}
}
