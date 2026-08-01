package com.skillswap.admin;

import com.skillswap.common.AdminUtils;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.common.AuditLogService;
import com.skillswap.safety.ReportPriority;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReport;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationDto;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import com.skillswap.moderation.FlaggedContent;
import com.skillswap.moderation.FlaggedContentRepository;
import com.skillswap.skill.SkillRepository;
import com.skillswap.notification.AppNotificationRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.mentorcertification.MentorCertificationDto;
import com.skillswap.mentorcertification.MentorCertificationService;
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
import com.skillswap.notification.NotificationBroadcast;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.review.MentorReview;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.watchlist.SkillWatchlistRepository;
import com.skillswap.monitoring.LogBufferService;
import com.skillswap.monitoring.MonitoringDtos;
import com.skillswap.monitoring.SystemHealthService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

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
    private final MentorCertificationService mentorCertificationService;
    private final WalletService walletService;
    private final BookingRepository bookingRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final DirectConversationRepository
            directConversationRepository;
    private final DirectMessageRepository directMessageRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final AuditLogRepository auditLogRepository;
    private final AuditLogService auditLogService;
    private final SessionRepository sessionRepository;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final AdminSettingRepository adminSettingRepository;
    private final AdminNotifPreferenceRepository
            adminNotifPreferenceRepository;
    private final ReferralRewardRepository referralRewardRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final SkillWatchlistRepository skillWatchlistRepository;
    private final FlaggedContentRepository flaggedContentRepository;
    private final SkillRepository skillRepository;
    private final AppNotificationRepository appNotificationRepository;
    private final AdminService adminService;
    private final CertMigrationService certMigrationService;
    private final SystemHealthService systemHealthService;
    private final AdminNotificationService adminNotificationService;
    private final com.skillswap.config.MaintenanceModeFilter maintenanceModeFilter;

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

    /**
     * Paginated admin reports queue with optional filters — status, target type,
     * priority, date range — plus free-text search across the report id, reason,
     * target label, and reporter / reported names and emails. Soft-deleted
     * (spam) reports are always excluded. Newest first by default.
     */
    @GetMapping("/reports")
    public ApiResponse<Page<AdminReportDto>> reports(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) ReportStatus status,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) ReportPriority priority,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            Pageable pageable) {
        ensureAdmin(currentUser);

        // Whitelist sortable columns — never pass raw user input to Sort.
        String sortField = switch (sortBy == null ? "createdAt" : sortBy.toLowerCase(Locale.ROOT)) {
            case "id" -> "id";
            case "priority" -> "priority";
            case "status" -> "status";
            case "updatedat" -> "updatedAt";
            default -> "createdAt";
        };
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        Page<UserReport> page = reportRepository.findByFilters(
                status,
                targetType != null && !targetType.isBlank() ? targetType.trim().toUpperCase(Locale.ROOT) : null,
                priority,
                parseReportDate(fromDate, false),
                parseReportDate(toDate, true),
                q,
                PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100),
                        Sort.by(direction, sortField)));

        return new ApiResponse<>("Reports fetched", page.map(AdminController::toReportDto));
    }

    /** Aggregated report stats for the dashboard cards — real DB counts only. */
    @GetMapping("/reports/stats")
    public ApiResponse<AdminReportStatsDto> reportStats(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        long total = 0, open = 0, inReview = 0, resolved = 0, rejected = 0;
        for (Object[] row : reportRepository.countGroupedByStatus()) {
            ReportStatus s = (ReportStatus) row[0];
            long count = ((Number) row[1]).longValue();
            total += count;
            switch (s) {
                case OPEN -> open = count;
                case IN_REVIEW -> inReview = count;
                case RESOLVED -> resolved = count;
                case REJECTED -> rejected = count;
                default -> { }
            }
        }
        long suspendedUsers = userRepository.countByEnabledFalse();
        return new ApiResponse<>("Report stats fetched",
                new AdminReportStatsDto(total, open, inReview, resolved, rejected, suspendedUsers));
    }

    /** Full detail for a single report, including assigned admin and internal notes. */
    @GetMapping("/reports/{id}")
    public ApiResponse<AdminReportDto> reportDetail(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Report fetched", toReportDto(findActiveReport(id)));
    }

    /** Assigns an admin (defaults to the current admin) — flips OPEN reports to IN_REVIEW. */
    @PatchMapping("/reports/{id}/assign")
    @Transactional
    public ApiResponse<AdminReportDto> assignReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) ReportAssignRequest request) {
        ensureAdmin(currentUser);

        UserReport report = findActiveReport(id);
        Long adminId = request != null && request.adminId() != null ? request.adminId() : currentUser.getId();
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found"));
        if (admin.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Can only assign reports to admins");
        }
        report.setAssignedAdmin(admin);
        if (report.getStatus() == ReportStatus.OPEN) {
            report.setStatus(ReportStatus.IN_REVIEW);
        }
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);

        saveAuditLog(currentUser, "ASSIGN_REPORT", "Report", id,
                "Assigned report #" + id + " to " + admin.getFullName() + " (" + admin.getEmail() + ")");
        return new ApiResponse<>("Report assigned", toReportDto(saved));
    }

    /** Moves a report between OPEN and IN_REVIEW (use /decision for RESOLVED / REJECTED). */
    @PatchMapping("/reports/{id}/status")
    @Transactional
    public ApiResponse<AdminReportDto> setReportStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ReportStatusRequest request) {
        ensureAdmin(currentUser);

        if (request.status() == null) {
            throw new IllegalArgumentException("A status is required");
        }
        if (request.status() == ReportStatus.RESOLVED || request.status() == ReportStatus.REJECTED) {
            throw new IllegalArgumentException("Use the decision endpoint to resolve or reject a report");
        }
        UserReport report = findActiveReport(id);
        report.setStatus(request.status());
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);
        saveAuditLog(currentUser, "UPDATE_REPORT_STATUS", "Report", id,
                "Set status to " + request.status());
        return new ApiResponse<>("Report status updated", toReportDto(saved));
    }

    /** Sets the triage priority (LOW / MEDIUM / HIGH / CRITICAL). */
    @PatchMapping("/reports/{id}/priority")
    @Transactional
    public ApiResponse<AdminReportDto> setReportPriority(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ReportPriorityRequest request) {
        ensureAdmin(currentUser);

        UserReport report = findActiveReport(id);
        report.setPriority(request.priority());
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);
        saveAuditLog(currentUser, "SET_REPORT_PRIORITY", "Report", id,
                "Set priority to " + request.priority());
        return new ApiResponse<>("Report priority updated", toReportDto(saved));
    }

    /** Appends an investigator-only note to the report (never shown to users). */
    @PatchMapping("/reports/{id}/notes")
    @Transactional
    public ApiResponse<AdminReportDto> addReportNote(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ReportNoteRequest request) {
        ensureAdmin(currentUser);

        if (request.note() == null || request.note().isBlank()) {
            throw new IllegalArgumentException("A note is required");
        }
        UserReport report = findActiveReport(id);
        String existing = report.getInternalNotes();
        String entry = OffsetDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                + " · " + currentUser.getFullName() + ": " + request.note().trim();
        report.setInternalNotes(existing == null || existing.isBlank() ? entry : existing + "\n" + entry);
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);
        saveAuditLog(currentUser, "ADD_REPORT_NOTE", "Report", id,
                "Added internal note: " + request.note().trim());
        return new ApiResponse<>("Note added", toReportDto(saved));
    }

    /** Suspends or restores the reported user's account, with notification + audit. */
    @PatchMapping("/reports/{id}/user-enabled")
    @Transactional
    public ApiResponse<AdminReportDto> setReportedUserEnabled(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody UserEnabledRequest request) {
        ensureAdmin(currentUser);

        UserReport report = findActiveReport(id);
        User reported = report.getReported();
        if (reported == null) {
            throw new IllegalArgumentException("This report has no reported user to suspend or restore");
        }
        if (currentUser.getId().equals(reported.getId())) {
            throw new IllegalArgumentException("Admins cannot change their own account");
        }
        boolean enabling = Boolean.TRUE.equals(request.enabled());
        if (reported.isEnabled() == enabling) {
            throw new IllegalArgumentException("Account is already " + (enabling ? "enabled" : "suspended"));
        }
        reported.setEnabled(enabling);
        userRepository.save(reported);
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);

        saveAuditLog(currentUser, enabling ? "UNSUSPEND_USER" : "SUSPEND_USER", "User", reported.getId(),
                (enabling ? "Restored account \"" : "Suspended account \"") + reported.getFullName()
                        + "\" via report #" + id);
        try {
            notificationService.notifyUser(reported.getId(),
                    enabling ? "ACCOUNT_RESTORED" : "ACCOUNT_SUSPENDED",
                    enabling ? "Account restored" : "Account suspended",
                    enabling
                            ? "Your account has been restored. You can sign in again."
                            : "Your account was suspended after a review. Contact support for details.",
                    id);
        } catch (Exception ignored) {
            // Notification failure must never fail the moderation action.
        }
        return new ApiResponse<>(enabling ? "User restored" : "User suspended", toReportDto(saved));
    }

    /** Soft-deletes a spam report so it leaves the queue while history is kept. */
    @DeleteMapping("/reports/{id}")
    @Transactional
    public ApiResponse<Map<String, String>> deleteReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);

        UserReport report = findActiveReport(id);
        report.setDeletedAt(OffsetDateTime.now());
        report.setUpdatedAt(OffsetDateTime.now());
        reportRepository.save(report);
        saveAuditLog(currentUser, "DELETE_REPORT", "Report", id,
                "Soft-deleted spam report #" + id);
        return new ApiResponse<>("Report deleted", Map.of("deletedReportId", String.valueOf(id)));
    }

    @PatchMapping("/reports/{id}")
    public ApiResponse<UserReport> updateReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ReportDecisionRequest request) {
        ensureAdmin(currentUser);

        UserReport report = findActiveReport(id);
        report.setStatus(request.status());
        report.setUpdatedAt(OffsetDateTime.now());
        return new ApiResponse<>("Report updated", reportRepository.save(report));
    }

    /**
     * Resolves or rejects a report. Optionally suspends the reported user's account
     * (mentor / learner targets) when {@code suspendUser} is set — disables the account,
     * records an audit log entry, and notifies the reported user. The reporter is always
     * notified of the decision.
     */
    @PatchMapping("/reports/{id}/decision")
    @Transactional
    public ApiResponse<UserReport> decideReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ReportDecisionRequest request) {
        ensureAdmin(currentUser);

        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        if (request.status() == null) {
            throw new IllegalArgumentException("A decision (RESOLVED or REJECTED) is required");
        }
        if (request.status() != ReportStatus.RESOLVED && request.status() != ReportStatus.REJECTED) {
            throw new IllegalArgumentException("Decision must be RESOLVED or REJECTED");
        }
        if (report.getStatus() == ReportStatus.RESOLVED || report.getStatus() == ReportStatus.REJECTED) {
            throw new IllegalArgumentException("Report is already " + report.getStatus().name());
        }

        report.setStatus(request.status());
        report.setModeratorNote(request.note());
        report.setUpdatedAt(OffsetDateTime.now());
        UserReport saved = reportRepository.save(report);

        // Suspend the reported user when requested (mentor / learner targets).
        boolean suspended = false;
        if (Boolean.TRUE.equals(request.suspendUser()) && saved.getReported() != null
                && saved.getReported().getId() != null
                && !saved.getReported().getId().equals(currentUser.getId())) {
            User reported = saved.getReported();
            if (reported.isEnabled()) {
                reported.setEnabled(false);
                userRepository.save(reported);
                suspended = true;
                saveAuditLog(currentUser, "SUSPEND_USER", "User", reported.getId(),
                        "Suspended user account \"" + reported.getFullName() + "\" after report #" + id);
                try {
                    notificationService.notifyUser(reported.getId(), "ACCOUNT_SUSPENDED",
                            "Account suspended",
                            "Your account was suspended after a review. Contact support for details.",
                            saved.getId());
                } catch (Exception ignored) {
                    // Notification failure must never fail the moderation action.
                }
            }
        }

        saveAuditLog(currentUser,
                request.status() == ReportStatus.RESOLVED ? "RESOLVE_REPORT" : "REJECT_REPORT",
                "Report", id,
                "Report #" + id + " " + request.status().name()
                        + (suspended ? " and reported user suspended" : "")
                        + (request.note() == null ? "" : " — " + request.note()));

        try {
            notificationService.notifyUser(saved.getReporter().getId(), "SAFETY_UPDATE",
                    "Report " + request.status().name().toLowerCase(Locale.ROOT),
                    "Your report #" + id + " was " + request.status().name().toLowerCase(Locale.ROOT) + ".",
                    saved.getId());
        } catch (Exception ignored) {
            // Notification failure must never fail the moderation action.
        }

        return new ApiResponse<>("Report decision applied", saved);
    }

    @GetMapping("/mentor-verifications")
    public ApiResponse<List<MentorVerificationDto>> mentorVerifications(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") MentorVerificationRequestStatus status) {
        ensureAdmin(currentUser);
        List<MentorVerificationDto> dtos = mentorVerificationRepository
                .findByStatusOrderByCreatedAtAsc(status)
                .stream()
                .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor())))
                .toList();
        return new ApiResponse<>("Mentor verification queue fetched", dtos);
    }

    private List<MentorCertificationDto> certificationsFor(com.skillswap.user.User mentor) {
        if (mentor == null || mentor.getId() == null) {
            return List.of();
        }
        return mentorCertificationService.listForMentor(mentor.getId());
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
        boolean enabling = Boolean.TRUE.equals(request.enabled());
        user.setEnabled(enabling);
        User saved = userRepository.save(user);
        saveAuditLog(currentUser, enabling ? "USER_ENABLE" : "USER_DISABLE", "User", id,
                (enabling ? "Enabled user account \"" : "Disabled user account \"")
                        + user.getFullName() + "\" (" + user.getEmail() + ")");
        return new ApiResponse<>("User status updated", saved);
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

    /**
     * Lists every conversation (booking + direct) for moderation, sorted by most
     * recent activity. Runs in a read-only transaction because the conversation
     * participants are lazily loaded entities and the app is configured with
     * {@code open-in-view: false} — without an open session any lazy access
     * would throw a LazyInitializationException (HTTP 500).
     */
    @GetMapping("/conversations")
    @Transactional(readOnly = true)
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

            // Batch-fetch the last message + unread counts for ALL booking IDs
            Map<Long, ChatMessage> lastMsgByBookingId = new HashMap<>();
            Map<Long, Long> unreadByBookingId = new HashMap<>();
            if (!bookingIds.isEmpty()) {
                for (ChatMessage msg : chatMessageRepository
                        .findLastMessagesByBookingIds(bookingIds)) {
                    lastMsgByBookingId.put(msg.getBooking().getId(), msg);
                }
                for (Object[] row : chatMessageRepository.countUnreadByBookingIds(bookingIds)) {
                    unreadByBookingId.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
                }
            }

            // Build DTOs using the lookup maps (no individual queries per booking)
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
                        b.getLearner().getDisplayUsername(),
                        b.getLearner().getEmail(),
                        b.getSession().getMentor().getId(),
                        b.getSession().getMentor().getFullName(),
                        b.getSession().getMentor().getDisplayUsername(),
                        b.getSession().getMentor().getEmail(),
                        unreadByBookingId.getOrDefault(b.getId(), 0L)));
            }
        }

        // ── Direct conversations (same batch pattern) ──
        if (type == null || "direct".equalsIgnoreCase(type)) {
            // findAllWithParticipants uses @EntityGraph so both participants are
            // loaded eagerly in the initial query (avoids lazy-load failures and N+1)
            List<DirectConversation> directs = directConversationRepository
                    .findAllWithParticipants(PageRequest.of(0, 500));

            // Collect all conversation IDs
            List<Long> convIds = directs.stream()
                    .map(DirectConversation::getId)
                    .collect(Collectors.toList());

            // Batch-fetch the last message + unread counts for ALL conversations
            Map<Long, DirectMessage> lastMsgByConvId = new HashMap<>();
            Map<Long, Long> unreadByConvId = new HashMap<>();
            if (!convIds.isEmpty()) {
                for (DirectMessage msg : directMessageRepository
                        .findLastMessagesByConversationIds(convIds)) {
                    if (msg.getConversation() != null) {
                        lastMsgByConvId.put(msg.getConversation().getId(), msg);
                    }
                }
                for (Object[] row : directMessageRepository.countUnreadByConversationIds(convIds)) {
                    unreadByConvId.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
                }
            }

            // Build DTOs using the lookup maps
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
                        dc.getParticipantOne().getDisplayUsername(),
                        dc.getParticipantOne().getEmail(),
                        dc.getParticipantTwo().getId(),
                        dc.getParticipantTwo().getFullName(),
                        dc.getParticipantTwo().getDisplayUsername(),
                        dc.getParticipantTwo().getEmail(),
                        unreadByConvId.getOrDefault(dc.getId(), 0L)));
            }
        }

        // Sort by most recent activity
        all.sort((a, b) -> b.lastActivityAt().compareTo(a.lastActivityAt()));

        // Filter by search query (participant name, username, email, session
        // title, or last-message preview)
        if (q != null && !q.isBlank()) {
            String lowered = q.toLowerCase();
            all = all.stream()
                    .filter(c -> contains(c.participantName(), lowered)
                            || contains(c.participantOneUsername(), lowered)
                            || contains(c.participantTwoUsername(), lowered)
                            || contains(c.participantOneEmail(), lowered)
                            || contains(c.participantTwoEmail(), lowered)
                            || contains(c.sessionTitle(), lowered)
                            || contains(c.lastMessagePreview(), lowered))
                    .collect(Collectors.toList());
        }

        return new ApiResponse<>("Conversations fetched", all);
    }

    @GetMapping("/conversations/booking/{bookingId}/messages")
    @Transactional(readOnly = true)
    public ApiResponse<List<AdminMessageDto>> getBookingConversationMessages(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long bookingId) {
        ensureAdmin(currentUser);

        List<ChatMessage> messages = chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        List<AdminMessageDto> dtos = messages.stream()
                .map(m -> new AdminMessageDto(m.getId(), "booking", bookingId,
                        m.getSender().getId(), m.getSender().getFullName(), m.getSender().getDisplayUsername(), m.getSender().getEmail(),
                        m.getContent(), m.isReadByRecipient(), m.getCreatedAt()))
                .collect(Collectors.toList());

        return new ApiResponse<>("Messages fetched", dtos);
    }

    @GetMapping("/conversations/direct/{conversationId}/messages")
    @Transactional(readOnly = true)
    public ApiResponse<List<AdminMessageDto>> getDirectConversationMessages(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long conversationId) {
        ensureAdmin(currentUser);

        List<DirectMessage> messages = directMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<AdminMessageDto> dtos = messages.stream()
                .map(m -> new AdminMessageDto(m.getId(), "direct", conversationId,
                        m.getSender().getId(), m.getSender().getFullName(), m.getSender().getDisplayUsername(), m.getSender().getEmail(),
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
                        userUsernameMap.put(u.getId(), u.getDisplayUsername());
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
            return new AdminUserDto(u.getId(), u.getEmail(), u.getFullName(), u.getDisplayUsername(), u.getRole().name(),
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
                new AdminUserWalletDto(user.getId(), user.getFullName(), user.getDisplayUsername(), balance.balance(), balance.currency(), history));
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
            // Total bookings of any status — mirrors the delete guard in
            // AdminService.deleteSession so the UI can disable deletion accurately.
            long bookingCount = bookingRepository.countBySessionId(s.getId());
            return new AdminSessionDto(s.getId(), s.getTitle(),
                    s.getMentor() != null ? s.getMentor().getId() : null,
                    s.getMentor() != null ? s.getMentor().getFullName() : "Unknown",
                    s.getMentor() != null ? s.getMentor().getDisplayUsername() : null,
                    s.getPriceAmount(), s.getStatus().name(), s.getSessionType(),
                    s.getStartTime(), s.getEndTime(), s.getMaxParticipants(),
                    (int) participantCount, (int) bookingCount, s.getCreatedAt());
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

    @DeleteMapping("/sessions/{id}")
    public ApiResponse<Map<String, String>> deleteSession(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);

        adminService.deleteSession(currentUser, id);
        return new ApiResponse<>("Session deleted", Map.of("deletedSessionId", String.valueOf(id)));
    }

    // ════════════════════════════════════════════════
    //  Admin — Notifications Broadcast
    // ════════════════════════════════════════════════

    /**
     * Sends an in-app notification to all users (or a role-scoped subset).
     * {@code type} selects the notification kind shown in the notification
     * center — ANNOUNCEMENT, MAINTENANCE, or PLATFORM_UPDATE (defaults to
     * ANNOUNCEMENT for backwards compatibility). Delivery reuses the existing
     * notification pipeline (DB persistence + WebSocket push).
     */
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

        String type = resolveBroadcastType(request.type());
        String targetRole = request.targetRole();
        int sentCount = adminService.broadcastNotification(request.title(), request.message(), targetRole, type);

        saveAuditLog(currentUser, "BROADCAST_NOTIFICATION", null, null,
                "Sent " + type + " '" + request.title() + "' to " + sentCount
                        + " users (role: " + (targetRole == null ? "all" : targetRole) + ")");
        return new ApiResponse<>("Broadcast sent",
                Map.of("sentCount", sentCount, "targetRole", targetRole == null ? "all" : targetRole,
                        "type", type));
    }

    private static String resolveBroadcastType(String type) {
        if (type == null || type.isBlank()) {
            return "ANNOUNCEMENT";
        }
        String normalized = type.trim().toUpperCase(Locale.ROOT);
        if ("ANNOUNCEMENT".equals(normalized) || "MAINTENANCE".equals(normalized)
                || "PLATFORM_UPDATE".equals(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("Type must be ANNOUNCEMENT, MAINTENANCE, or PLATFORM_UPDATE");
    }

    // ════════════════════════════════════════════════
    //  Admin — Notification & Broadcast Center
    // ════════════════════════════════════════════════

    /** Dashboard cards — real DB counts only (total, read, unread, scheduled, sent today, by type). */
    @GetMapping("/notification-center/dashboard")
    public ApiResponse<Map<String, Object>> notificationCenterDashboard(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Notification dashboard fetched",
                adminNotificationService.dashboardStats());
    }

    /** Paginated broadcast history with search + type/priority/status/audience/date filters. */
    @GetMapping("/notification-center")
    public ApiResponse<Page<Map<String, Object>>> notificationCenterHistory(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            Pageable pageable) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Broadcast history fetched", adminNotificationService.history(
                type, priority, status, scope, q, fromDate, toDate,
                PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100),
                        org.springframework.data.domain.Sort.by(
                                org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))));
    }

    /** Full detail for one broadcast, including live delivery/read/click counters. */
    @GetMapping("/notification-center/{id}")
    public ApiResponse<Map<String, Object>> notificationCenterDetail(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Broadcast fetched", adminNotificationService.detail(id));
    }

    /** Paginated list of individual deliveries (recipients) for a broadcast. */
    @GetMapping("/notification-center/{id}/recipients")
    public ApiResponse<Page<Map<String, Object>>> notificationCenterRecipients(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            Pageable pageable) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Recipients fetched", adminNotificationService.recipients(
                id, PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 50))));
    }

    /** Creates a broadcast — sends immediately when no schedule time is given. */
    @PostMapping("/notification-center")
    public ApiResponse<NotificationBroadcastDto> createBroadcast(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AdminNotificationCreateRequest request) {
        ensureAdmin(currentUser);
        if (request.title() == null || request.title().isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (request.message() == null || request.message().isBlank()) {
            throw new IllegalArgumentException("Message is required");
        }
        NotificationBroadcastDto dto = toBroadcastDto(adminNotificationService.createBroadcast(
                currentUser, request.title().trim(), request.subtitle(), request.message().trim(),
                request.type(), request.priority(), request.targetScope(), request.targetDetail(),
                request.scheduleTime(), request.expiresAt(), request.repeatType(),
                request.actionButtonText(), request.actionUrl(),
                Boolean.TRUE.equals(request.sendNow())));
        return new ApiResponse<>("Broadcast created", dto);
    }

    /** Edits a DRAFT or SCHEDULED broadcast. */
    @PatchMapping("/notification-center/{id}")
    public ApiResponse<NotificationBroadcastDto> editBroadcast(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody AdminNotificationCreateRequest request) {
        ensureAdmin(currentUser);
        NotificationBroadcastDto dto = toBroadcastDto(adminNotificationService.editBroadcast(
                currentUser, id, request.title(), request.subtitle(), request.message(),
                request.type(), request.priority(), request.targetScope(), request.targetDetail(),
                request.scheduleTime(), request.expiresAt(), request.repeatType(),
                request.actionButtonText(), request.actionUrl()));
        return new ApiResponse<>("Broadcast updated", dto);
    }

    /** Sends a DRAFT or SCHEDULED broadcast immediately. */
    @PostMapping("/notification-center/{id}/send")
    public ApiResponse<NotificationBroadcastDto> sendBroadcastNow(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        NotificationBroadcastDto dto = toBroadcastDto(adminNotificationService.sendNow(currentUser, id));
        return new ApiResponse<>("Broadcast sent", dto);
    }

    /** Cancels a SCHEDULED broadcast so it never fires. */
    @PostMapping("/notification-center/{id}/cancel")
    public ApiResponse<NotificationBroadcastDto> cancelBroadcast(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        NotificationBroadcastDto dto = toBroadcastDto(adminNotificationService.cancelScheduled(currentUser, id));
        return new ApiResponse<>("Broadcast cancelled", dto);
    }

    /** Duplicates a broadcast as a new DRAFT. */
    @PostMapping("/notification-center/{id}/duplicate")
    public ApiResponse<NotificationBroadcastDto> duplicateBroadcast(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        NotificationBroadcastDto dto = toBroadcastDto(adminNotificationService.duplicate(currentUser, id));
        return new ApiResponse<>("Broadcast duplicated", dto);
    }

    /** Archives a broadcast so it leaves the active history. */
    @PostMapping("/notification-center/{id}/archive")
    public ApiResponse<NotificationBroadcastDto> archiveBroadcast(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        NotificationBroadcastDto dto = toBroadcastDto(adminNotificationService.archive(currentUser, id));
        return new ApiResponse<>("Broadcast archived", dto);
    }

    /** Resends a SENT broadcast to everyone who has not read it yet. */
    @PostMapping("/notification-center/{id}/resend")
    public ApiResponse<Map<String, Object>> resendBroadcast(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        int resent = adminNotificationService.resendToUnread(currentUser, id);
        return new ApiResponse<>("Broadcast resent",
                Map.of("resent", resent, "broadcastId", id));
    }

    /** Soft-deletes a broadcast (kept for audit, excluded from lists). */
    @DeleteMapping("/notification-center/{id}")
    public ApiResponse<Map<String, String>> deleteBroadcast(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        adminNotificationService.delete(currentUser, id);
        return new ApiResponse<>("Broadcast deleted", Map.of("deletedBroadcastId", String.valueOf(id)));
    }

    /** Analytics — read/click/delivery rates, most-opened, monthly + daily trends. */
    @GetMapping("/notification-center/analytics")
    public ApiResponse<Map<String, Object>> notificationCenterAnalytics(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "6") int months) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Notification analytics fetched",
                adminNotificationService.analytics(months));
    }

    private static NotificationBroadcastDto toBroadcastDto(NotificationBroadcast b) {
        return new NotificationBroadcastDto(b.getId(), b.getTitle(), b.getSubtitle(), b.getMessage(),
                b.getType(), b.getPriority(), b.getStatus(), b.getTargetScope(), b.getTargetDetail(),
                b.getScheduleTime(), b.getSentAt(), b.getExpiresAt(), b.getRepeatType(),
                b.getActionButtonText(), b.getActionUrl(), b.getTotalTargets(), b.getDeliveredCount(),
                b.getReadCount(), b.getClickedCount(), b.getFailedCount(),
                b.getCreatedBy() != null ? b.getCreatedBy().getFullName() : "Unknown",
                b.getCreatedAt(), b.getCancelledAt(), b.getArchivedAt());
    }

    // ════════════════════════════════════════════════
    //  Admin — Audit Log · Activity Timeline & Security Audit
    // ════════════════════════════════════════════════

    /**
     * Paginated activity timeline with server-side filters — action, module,
     * severity, outcome, entity type, user, date range — plus free-text search
     * across action, details, admin email, IP, browser, device and endpoint.
     * Archived entries are hidden unless {@code includeArchived} is set.
     * Backwards compatible: a bare {@code action} filter uses the legacy query.
     */
    @GetMapping("/audit-log")
    public ApiResponse<Page<AdminAuditLogDto>> getAuditLog(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            Pageable pageable) {
        ensureAdmin(currentUser);

        boolean hasAdvancedFilters = module != null || severity != null || outcome != null
                || entityType != null || userId != null || fromDate != null || toDate != null
                || (q != null && !q.isBlank()) || includeArchived;

        Page<AuditLog> logPage;
        if (hasAdvancedFilters) {
            logPage = auditLogRepository.findByFilters(
                    blankToNull(action), blankToNull(module), blankToNull(severity),
                    blankToNull(outcome), blankToNull(entityType), userId,
                    parseReportDate(fromDate, false), parseReportDate(toDate, true),
                    includeArchived, blankToNull(q),
                    PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100),
                            Sort.by(Sort.Direction.DESC, "createdAt")));
        } else if (action != null && !action.isBlank()) {
            List<AuditLog> logs = auditLogRepository.findByActionContainingIgnoreCaseOrderByCreatedAtDesc(
                    action, PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100)));
            // Wrap in a Page for consistent API response
            long total = auditLogRepository.countByActionContainingIgnoreCase(action);
            logPage = new PageImpl<>(logs, pageable, total);
        } else {
            logPage = auditLogRepository.findAll(PageRequest.of(pageable.getPageNumber(),
                    Math.min(pageable.getPageSize(), 100),
                    Sort.by(Sort.Direction.DESC, "createdAt")));
        }

        return new ApiResponse<>("Audit log fetched", logPage.map(AdminController::toAuditLogDto));
    }

    /** Single activity entry — the detail drawer source. Read-only by design. */
    @GetMapping("/audit-log/{id}")
    public ApiResponse<AdminAuditLogDto> auditLogDetail(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        AuditLog log = auditLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Audit log entry not found"));
        return new ApiResponse<>("Audit entry fetched", toAuditLogDto(log));
    }

    /**
     * Dashboard statistics for the audit timeline — every number is a real DB
     * count (never hardcoded). Includes severity/module distribution and a
     * 14-day daily trend for the charts.
     */
    @GetMapping("/audit-log/stats")
    public ApiResponse<AdminAuditStatsDto> auditLogStats(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime todayStart = now.withHour(0).withMinute(0).withSecond(0).withNano(0);
        OffsetDateTime dayAgo = now.minusDays(1);
        OffsetDateTime monthAgo = now.minusDays(30);

        long total = auditLogRepository.countByArchivedAtIsNull();
        long today = auditLogRepository.countByArchivedAtIsNullAndCreatedAtAfter(todayStart);
        long last24h = auditLogRepository.countByArchivedAtIsNullAndCreatedAtAfter(dayAgo);
        long security24h = auditLogRepository
                .countByModuleAndArchivedAtIsNullAndCreatedAtAfter(AuditLogService.MOD_SECURITY, dayAgo);
        long failedLogins24h = auditLogRepository
                .countByActionContainingIgnoreCaseAndCreatedAtAfter("FAILED_LOGIN", dayAgo);
        long adminActions30d = auditLogRepository
                .countByAdminIdIsNotNullAndArchivedAtIsNullAndCreatedAtAfter(monthAgo);
        long userActions30d = auditLogRepository
                .countByModuleAndArchivedAtIsNullAndCreatedAtAfter(AuditLogService.MOD_USER, monthAgo);
        long warnings24h = auditLogRepository.countBySeverityAndCreatedAtAfter(AuditLogService.SEV_WARNING, dayAgo);
        long critical24h = auditLogRepository.countBySeverityAndCreatedAtAfter(AuditLogService.SEV_CRITICAL, dayAgo);

        List<NameCountDto> bySeverity = new ArrayList<>();
        for (Object[] row : auditLogRepository.countGroupedBySeveritySince(monthAgo)) {
            bySeverity.add(new NameCountDto(String.valueOf(row[0]), ((Number) row[1]).longValue()));
        }
        List<NameCountDto> byModule = new ArrayList<>();
        for (Object[] row : auditLogRepository.countGroupedByModuleSince(monthAgo)) {
            byModule.add(new NameCountDto(String.valueOf(row[0]), ((Number) row[1]).longValue()));
        }
        List<NameCountDto> dailyTrend = new ArrayList<>();
        OffsetDateTime trendStart = now.minusDays(13).withHour(0).withMinute(0).withSecond(0).withNano(0);
        for (Object[] row : auditLogRepository.countDailyTrendSince(trendStart)) {
            dailyTrend.add(new NameCountDto(String.valueOf(row[0]), ((Number) row[1]).longValue()));
        }

        double successRate = last24h == 0 ? 100
                : Math.round(((last24h - failedLogins24h) * 100.0 / last24h) * 10.0) / 10.0;

        return new ApiResponse<>("Audit stats fetched", new AdminAuditStatsDto(
                total, today, last24h, security24h, failedLogins24h, adminActions30d, userActions30d,
                warnings24h, critical24h, successRate, bySeverity, byModule, dailyTrend));
    }

    /**
     * Security monitoring — highlights real suspicious patterns from the audit
     * trail: repeated failed logins per IP, repeated password resets / account
     * disables, admin privilege changes and recent errors.
     */
    @GetMapping("/audit-log/security-alerts")
    public ApiResponse<AdminSecurityAlertsDto> auditSecurityAlerts(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        OffsetDateTime dayAgo = OffsetDateTime.now().minusDays(1);

        List<AlertGroupDto> repeatedFailedLogins = new ArrayList<>();
        for (Object[] row : auditLogRepository.repeatedFailedLoginsByIp(dayAgo)) {
            repeatedFailedLogins.add(new AlertGroupDto(String.valueOf(row[0]), ((Number) row[1]).longValue()));
        }
        List<AlertGroupDto> repeatedPasswordResets = new ArrayList<>();
        for (Object[] row : auditLogRepository.repeatedPasswordResets(dayAgo)) {
            repeatedPasswordResets.add(new AlertGroupDto("user #" + row[0], ((Number) row[1]).longValue()));
        }
        List<AlertGroupDto> repeatedDisables = new ArrayList<>();
        for (Object[] row : auditLogRepository.repeatedAccountDisables(dayAgo)) {
            repeatedDisables.add(new AlertGroupDto(String.valueOf(row[0]), ((Number) row[1]).longValue()));
        }
        List<AdminAuditLogDto> privilegeChanges = auditLogRepository
                .privilegeChangesSince(dayAgo, PageRequest.of(0, 20)).stream()
                .map(AdminController::toAuditLogDto).toList();
        List<AdminAuditLogDto> recentErrors = auditLogRepository
                .errorsSince(dayAgo, PageRequest.of(0, 20)).stream()
                .map(AdminController::toAuditLogDto).toList();

        long totalAlerts = repeatedFailedLogins.size() + repeatedPasswordResets.size()
                + repeatedDisables.size() + privilegeChanges.size() + recentErrors.size();

        return new ApiResponse<>("Security alerts fetched", new AdminSecurityAlertsDto(
                totalAlerts, repeatedFailedLogins, repeatedPasswordResets, repeatedDisables,
                privilegeChanges, recentErrors));
    }

    /** Current retention policy (days) + how many entries are already expired. */
    @GetMapping("/audit-log/retention")
    public ApiResponse<Map<String, Object>> getAuditRetention(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        int days = auditRetentionDays();
        return new ApiResponse<>("Retention fetched", Map.of(
                "days", days,
                "expiredCount", auditLogRepository.countExpired(OffsetDateTime.now().minusDays(days))));
    }

    /** Updates the audit retention policy (30 / 90 / 180 / 365 days …). */
    @PutMapping("/audit-log/retention")
    @Transactional
    public ApiResponse<Map<String, Object>> setAuditRetention(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AuditRetentionRequest request) {
        ensureAdmin(currentUser);
        int days = Math.max(1, Math.min(3650, request.days()));
        AdminSetting setting = adminSettingRepository.findBySettingKey(AuditLogService.SETTING_AUDIT_RETENTION_DAYS)
                .orElseGet(() -> {
                    AdminSetting s = new AdminSetting();
                    s.setSettingKey(AuditLogService.SETTING_AUDIT_RETENTION_DAYS);
                    return s;
                });
        setting.setSettingValue(String.valueOf(days));
        adminSettingRepository.save(setting);
        saveAuditLog(currentUser, "UPDATE_AUDIT_RETENTION", "Settings", null,
                "Set audit log retention to " + days + " days");
        return new ApiResponse<>("Retention updated", Map.of("days", days));
    }

    /** Applies the retention policy now — deletes expired entries (audit action itself is logged). */
    @PostMapping("/audit-log/purge")
    @Transactional
    public ApiResponse<Map<String, Object>> purgeAuditLogs(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        int days = auditRetentionDays();
        int removed = auditLogService.purgeOlderThan(OffsetDateTime.now().minusDays(days));
        saveAuditLog(currentUser, "PURGE_AUDIT_LOGS", "Settings", null,
                "Purged " + removed + " audit entries older than " + days + " days");
        return new ApiResponse<>("Audit logs purged", Map.of("removed", removed, "cutoffDays", days));
    }

    private int auditRetentionDays() {
        // Delegate to the service — single source of truth shared with the nightly sweep.
        return auditLogService.configuredRetentionDays();
    }

    private static AdminAuditLogDto toAuditLogDto(AuditLog l) {
        return new AdminAuditLogDto(l.getId(), l.getAdminId(), l.getAdminEmail(), l.getAction(),
                l.getEntityType(), l.getEntityId(), l.getDetails(), l.getCreatedAt(),
                l.getIpAddress(), l.getUserId(), l.getResource(), l.getResourceId(),
                l.getSeverity(), l.getModule(), l.getOutcome(), l.getBeforeValue(), l.getAfterValue(),
                l.getUserAgent(), l.getDevice(), l.getBrowser(), l.getOs(),
                l.getRequestId(), l.getCorrelationId(), l.getEndpoint(), l.getArchivedAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    // ════════════════════════════════════════════════
    //  Admin — Flagged Content
    // ════════════════════════════════════════════════

    @GetMapping("/flagged-content")
    public ApiResponse<List<UserReport>> getFlaggedContent(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "OPEN") ReportStatus status) {
        ensureAdmin(currentUser);
        // Exclude soft-deleted (spam) reports so they never resurface in the queue.
        return new ApiResponse<>("Flagged content fetched",
                reportRepository.findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(status));
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
        // Seed every known key from the catalog so the UI always has a value,
        // then overlay stored rows (stored values must win over defaults).
        Map<String, String> result = new HashMap<>(PlatformSettingsCatalog.defaults());
        for (AdminSetting s : allSettings) {
            result.put(s.getSettingKey(), s.getSettingValue());
        }
        return result;
    }

    @GetMapping("/settings")
    public ApiResponse<Map<String, String>> getSettings(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Settings fetched", loadSettingsMap());
    }

    /**
     * Settings catalog — categories, definitions, types and current values, all
     * derived from the backend catalog so the admin UI renders from real data.
     */
    @GetMapping("/settings/catalog")
    public ApiResponse<List<AdminSettingsCategoryDto>> getSettingsCatalog(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        Map<String, String> current = loadSettingsMap();
        Map<String, List<PlatformSettingsCatalog.SettingDef>> grouped = PlatformSettingsCatalog.groupedByCategory();
        // Real stored preference values so the synthesized Notifications fields
        // reflect what is actually saved (not a hardcoded default).
        Map<String, Boolean> prefValues = new HashMap<>();
        for (AdminNotifPreference pref : adminNotifPreferenceRepository.findAll()) {
            prefValues.put(pref.getPrefKey(), pref.isPrefValue());
        }

        List<AdminSettingsCategoryDto> categories = new ArrayList<>();
        for (PlatformSettingsCatalog.Category category : PlatformSettingsCatalog.CATEGORIES) {
            if (PlatformSettingsCatalog.CAT_NOTIFICATIONS.equals(category.id())) {
                // Notification preferences live in their own table — expose them
                // as boolean fields so the Notifications section renders in the UI.
                List<AdminSettingFieldDto> fields = PlatformSettingsCatalog.NOTIFICATION_PREFS.entrySet().stream()
                        .map(e -> new AdminSettingFieldDto(e.getKey(), "boolean", e.getValue(), "",
                                String.valueOf(prefValues.getOrDefault(e.getKey(), true)),
                                List.of("true", "false")))
                        .toList();
                categories.add(new AdminSettingsCategoryDto(category.id(), category.label(),
                        category.description(), fields));
                continue;
            }
            List<PlatformSettingsCatalog.SettingDef> defs = grouped.getOrDefault(category.id(), List.of());
            if (defs.isEmpty()) continue;
            List<AdminSettingFieldDto> fields = defs.stream()
                    .map(d -> new AdminSettingFieldDto(d.key(), d.type(), d.label(), d.description(),
                            current.getOrDefault(d.key(), d.defaultValue()), d.options()))
                    .toList();
            categories.add(new AdminSettingsCategoryDto(category.id(), category.label(),
                    category.description(), fields));
        }
        return new ApiResponse<>("Settings catalog fetched", categories);
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

        // Only persist + audit keys whose value actually changed — no repeated
        // saves or noisy audit entries for untouched fields.
        Map<String, String> before = loadSettingsMap();
        java.util.Map<String, String> changes = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, String> entry : settings.entrySet()) {
            if (entry.getValue() == null) continue;
            String oldValue = before.getOrDefault(entry.getKey(), "");
            if (!oldValue.equals(entry.getValue())) {
                changes.put(entry.getKey(), entry.getValue());
            }
        }

        if (changes.isEmpty()) {
            return new ApiResponse<>("No settings changed", loadSettingsMap());
        }

        java.util.Set<String> written = adminService.persistSettings(changes);

        // Maintenance-mode toggle must apply immediately, not after the 30s filter TTL.
        if (written.contains("maintenance_mode")) {
            maintenanceModeFilter.invalidateCache();
        }

        for (String key : written) {
            String oldValue = before.getOrDefault(key, "");
            String newValue = changes.get(key);
            saveAuditLog(currentUser, "UPDATE_SETTING", "Settings", null,
                    "Changed '" + key + "' from '" + oldValue + "' to '" + newValue + "'",
                    oldValue, newValue);
        }

        return new ApiResponse<>("Settings updated", loadSettingsMap());
    }

    /** Resets one settings category back to its catalog defaults. */
    @PostMapping("/settings/reset-section")
    public ApiResponse<Map<String, Object>> resetSettingsSection(
            @AuthenticationPrincipal User currentUser,
            @RequestBody(required = false) AdminSettingsResetRequest request) {
        ensureAdmin(currentUser);
        if (request == null || request.category() == null || request.category().isBlank()) {
            throw new IllegalArgumentException("A category is required");
        }
        int reset = adminService.resetSettingsSection(request.category());
        // A maintenance-category reset may have flipped maintenance_mode back to
        // its default — invalidate the filter cache so it applies immediately.
        maintenanceModeFilter.invalidateCache();
        saveAuditLog(currentUser, "RESET_SETTINGS_SECTION", "Settings", null,
                "Reset settings category '" + request.category() + "' (" + reset + " keys)");
        return new ApiResponse<>("Settings section reset",
                Map.of("reset", reset, "category", request.category()));
    }

    /** Resets every known platform setting back to its catalog default. */
    @PostMapping("/settings/reset-all")
    public ApiResponse<Map<String, Object>> resetAllSettings(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        int reset = adminService.resetAllSettings();
        maintenanceModeFilter.invalidateCache();
        saveAuditLog(currentUser, "RESET_ALL_SETTINGS", "Settings", null,
                "Reset all platform settings (" + reset + " keys)");
        return new ApiResponse<>("All settings reset", Map.of("reset", reset));
    }

    /** Downloads the current configuration as a CSV blob (filter-aware settings export). */
    @GetMapping("/settings/export")
    public org.springframework.http.ResponseEntity<byte[]> exportSettings(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        Map<String, String> current = loadSettingsMap();
        StringBuilder csv = new StringBuilder("category,key,type,label,value\n");
        for (PlatformSettingsCatalog.SettingDef def : PlatformSettingsCatalog.DEFINITIONS) {
            csv.append(escaped(def.category())).append(',')
                    .append(escaped(def.key())).append(',')
                    .append(escaped(def.type())).append(',')
                    .append(escaped(def.label())).append(',')
                    .append(escaped(current.getOrDefault(def.key(), def.defaultValue())))
                    .append('\n');
        }
        return org.springframework.http.ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=skillswap-settings.csv")
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                .body(csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /** Recent buffered system logs (feed for the Settings → Maintenance download). */
    @GetMapping("/settings/logs")
    public ApiResponse<List<LogBufferService.LogEntry>> getSettingsLogs(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "100") int limit) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Logs fetched",
                systemHealthService.recentLogs(level, null, Math.min(Math.max(limit, 1), 500)));
    }

    /** Invalidates the maintenance-mode filter cache so toggles apply instantly. */
    @PostMapping("/settings/clear-cache")
    public ApiResponse<Map<String, String>> clearSettingsCache(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        maintenanceModeFilter.invalidateCache();
        saveAuditLog(currentUser, "CLEAR_SETTINGS_CACHE", "Settings", null,
                "Cleared maintenance-mode settings cache");
        return new ApiResponse<>("Cache cleared", Map.of("cache", "cleared"));
    }

    private static String escaped(String value) {
        String v = value == null ? "" : value;
        // Neutralize CSV formula injection (Excel interprets = + - @ as formulas).
        if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }

    // ════════════════════════════════════════════════
    //  Admin — Dashboard
    // ════════════════════════════════════════════════

    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public ApiResponse<AdminDashboardDto> getDashboard(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false, defaultValue = "6") int months,
            @RequestParam(required = false, defaultValue = "30") int days) {
        ensureAdmin(currentUser);
        months = Math.max(1, Math.min(24, months));
        days = Math.max(1, Math.min(365, days));
        long startedNanos = System.nanoTime();

        OffsetDateTime now = OffsetDateTime.now();
        List<OffsetDateTime> monthList = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            monthList.add(now.minusMonths(i).withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0));
        }

        // Use aggregate queries instead of loading entire tables into memory
        long totalUsers = userRepository.count();
        long totalMentors = userRepository.countByRole(UserRole.MENTOR);
        long totalLearners = userRepository.countByRole(UserRole.LEARNER);
        // Sessions are the sellable catalog entries (separate from bookings);
        // the dashboard reports both so the "Total Sessions" KPI is a real
        // count of SkillSession rows, not a stand-in for bookings.
        long totalSessions = sessionRepository.count();
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

        // ── Extended KPIs (all real DB counts) ──
        long verifiedMentors = userRepository.countByMentorVerifiedTrue();
        long pendingVerifications = mentorVerificationRepository
                .countByStatus(MentorVerificationRequestStatus.PENDING);
        long totalSkills = skillRepository.count();
        long cancelledSessions = sessionRepository.countByStatus(SessionStatus.CANCELLED);
        long pendingRequests = bookingRepository.countByBookingStatus(BookingStatus.PENDING);
        long activeConversations = directConversationRepository.count()
                + chatMessageRepository.countDistinctBookingIds();
        long openReports = reportRepository.countByStatus(ReportStatus.OPEN);
        long flaggedContent = flaggedContentRepository.countByDeletedAtIsNull();
        long totalPayments = paymentRepository.count();

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

        // ── Monthly session completion rate (completed ÷ total bookings per month) ──
        // The completed side reuses the already-computed sessionMonthMap so the
        // dashboard loads with a single extra aggregate query, not two.
        Map<Integer, Long> totalBookingMonthMap = new HashMap<>();
        for (Object[] row : bookingRepository.computeMonthlyBookingTrend(monthList.get(0))) {
            totalBookingMonthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        List<MonthlyBucket> completionTrend = monthList.stream().map(m -> {
            int key = m.getYear() * 100 + m.getMonthValue();
            long total = totalBookingMonthMap.getOrDefault(key, 0L);
            long completed = sessionMonthMap.getOrDefault(key, 0L);
            double rate = total == 0 ? 0 : Math.round((completed * 100.0 / total) * 10.0) / 10.0;
            return new MonthlyBucket(m.format(java.time.format.DateTimeFormatter.ofPattern("MMM")), rate);
        }).collect(Collectors.toList());

        // ── Top skills: mentor skill listings + learner watchlists ──
        Map<String, Long> skillCounts = new HashMap<>();
        Map<String, String> skillDisplay = new HashMap<>();
        for (String skillsRaw : userRepository.findSkillsByRole(UserRole.MENTOR)) {
            if (skillsRaw == null || skillsRaw.isBlank()) continue;
            for (String raw : skillsRaw.split("[,;\n|]")) {
                String name = raw.trim();
                if (name.length() < 2) continue;
                String key = name.toLowerCase(Locale.ROOT);
                skillCounts.merge(key, 1L, Long::sum);
                skillDisplay.putIfAbsent(key, name);
            }
        }
        for (Object[] row : skillWatchlistRepository.countGroupedBySkillName()) {
            String name = ((String) row[0]).trim();
            long count = ((Number) row[1]).longValue();
            String key = name.toLowerCase(Locale.ROOT);
            skillCounts.merge(key, count, Long::sum);
            skillDisplay.putIfAbsent(key, name);
        }
        List<AdminTopSkillDto> topSkills = skillCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .map(e -> new AdminTopSkillDto(skillDisplay.getOrDefault(e.getKey(), e.getKey()), e.getValue()))
                .collect(Collectors.toList());

        // ── Most active mentors by booking count ──
        List<Object[]> topMentorRows = bookingRepository.countTopMentorBookings();
        List<Long> topMentorIds = topMentorRows.stream()
                .map(r -> ((Number) r[0]).longValue())
                .collect(Collectors.toList());
        Map<Long, User> mentorMap = new HashMap<>();
        if (!topMentorIds.isEmpty()) {
            userRepository.findAllById(topMentorIds).forEach(u -> mentorMap.put(u.getId(), u));
        }
        List<AdminTopMentorDto> topMentors = topMentorRows.stream()
                .map(r -> {
                    Long mentorId = ((Number) r[0]).longValue();
                    long count = ((Number) r[1]).longValue();
                    User mentor = mentorMap.get(mentorId);
                    return new AdminTopMentorDto(mentorId,
                            mentor != null ? mentor.getFullName() : "Deleted Mentor",
                            mentor != null ? mentor.getDisplayUsername() : "",
                            count);
                })
                .collect(Collectors.toList());

        double platformFees = Math.round(totalReleasedAmount * 0.10 * 100.0) / 100.0;
        // Window-scoped revenue (released payments within the selected range) —
        // makes the date filter actually affect the revenue KPI.
        java.math.BigDecimal windowRevenueRaw = paymentRepository
                .computeRevenueSince(now.minusDays(days));
        double monthlyRevenue = windowRevenueRaw != null ? windowRevenueRaw.doubleValue() : 0;

        // ── Monthly reports & flagged-content trends (real DB counts) ──
        Map<Integer, Long> reportMonthMap = new HashMap<>();
        for (Object[] row : reportRepository.computeMonthlyTrend(monthList.get(0))) {
            reportMonthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        List<MonthlyBucket> reportsTrend = buildMonthlyCountBucketsFromMap(monthList, reportMonthMap);

        Map<Integer, Long> flaggedMonthMap = new HashMap<>();
        for (Object[] row : flaggedContentRepository.computeMonthlyTrend(monthList.get(0))) {
            flaggedMonthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        List<MonthlyBucket> flaggedTrend = buildMonthlyCountBucketsFromMap(monthList, flaggedMonthMap);

        // ── Daily activity (signups + logins) for the selected window ──
        OffsetDateTime sinceDays = now.minusDays(days - 1L).withHour(0).withMinute(0).withSecond(0).withNano(0);
        java.util.Map<java.time.LocalDate, Long> signupDayMap = new java.util.HashMap<>();
        for (Object[] row : userRepository.countDailySignups(sinceDays)) {
            java.time.LocalDate d = toLocalDate(row[0]);
            if (d != null) {
                signupDayMap.put(d, ((Number) row[1]).longValue());
            }
        }
        java.util.Map<java.time.LocalDate, Long> activeDayMap = new java.util.HashMap<>();
        for (Object[] row : userRepository.countDailyActive(sinceDays)) {
            java.time.LocalDate d = toLocalDate(row[0]);
            if (d != null) {
                activeDayMap.put(d, ((Number) row[1]).longValue());
            }
        }
        java.time.format.DateTimeFormatter dayFmt = java.time.format.DateTimeFormatter.ofPattern("MMM d");
        List<DailyBucket> dailySignups = new ArrayList<>();
        List<DailyBucket> dailyActive = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            java.time.LocalDate d = java.time.LocalDate.now().minusDays(i);
            dailySignups.add(new DailyBucket(dayFmt.format(d), signupDayMap.getOrDefault(d, 0L)));
            dailyActive.add(new DailyBucket(dayFmt.format(d), activeDayMap.getOrDefault(d, 0L)));
        }

        // ── Distributions (real DB counts) ──
        List<AdminNameCountDto> sessionStatusDistribution = new ArrayList<>();
        for (Object[] row : sessionRepository.countGroupedByStatus()) {
            sessionStatusDistribution.add(new AdminNameCountDto(
                    ((SessionStatus) row[0]).name(), ((Number) row[1]).longValue()));
        }
        List<AdminNameCountDto> verificationDistribution = new ArrayList<>();
        for (Object[] row : mentorVerificationRepository.countGroupedByStatus()) {
            verificationDistribution.add(new AdminNameCountDto(
                    ((MentorVerificationRequestStatus) row[0]).name(), ((Number) row[1]).longValue()));
        }

        // ── Most active learners by booking count ──
        List<Object[]> topLearnerRows = bookingRepository.countTopLearnerBookings();
        List<Long> topLearnerIds = topLearnerRows.stream()
                .map(r -> ((Number) r[0]).longValue()).collect(Collectors.toList());
        Map<Long, User> learnerMap = new HashMap<>();
        if (!topLearnerIds.isEmpty()) {
            userRepository.findAllById(topLearnerIds).forEach(u -> learnerMap.put(u.getId(), u));
        }
        List<AdminTopLearnerDto> topLearners = topLearnerRows.stream().map(r -> {
            Long learnerId = ((Number) r[0]).longValue();
            long count = ((Number) r[1]).longValue();
            User learner = learnerMap.get(learnerId);
            return new AdminTopLearnerDto(learnerId,
                    learner != null ? learner.getFullName() : "Deleted User",
                    learner != null ? learner.getDisplayUsername() : "",
                    count);
        }).collect(Collectors.toList());

        // ── Recent activity timeline (merged, newest first) ──
        List<AdminActivityDto> recentActivity = buildRecentActivity();

        // ── Platform health ──
        Runtime rt = Runtime.getRuntime();
        long storageUsageMb = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long errorRate24h = auditLogRepository
                .countByActionContainingIgnoreCaseAndCreatedAtAfter("ERROR", now.minusDays(1));
        long notificationQueueToday = appNotificationRepository.countByCreatedAtAfter(todayStart);
        // Email queue = recent outbound email audit events (no dedicated queue table).
        long emailQueueToday = auditLogRepository
                .countByActionContainingIgnoreCaseAndCreatedAtAfter("EMAIL", now.minusDays(1));
        long apiResponseTimeMs = Math.max(1, (System.nanoTime() - startedNanos) / 1_000_000);
        AdminPlatformHealthDto platformHealth = new AdminPlatformHealthDto(
                "UP", "UP", apiResponseTimeMs, storageUsageMb, errorRate24h,
                notificationQueueToday, emailQueueToday);

        AdminDashboardDto dashboard = new AdminDashboardDto(signupTrend, revenueTrend, sessionTrend,
                completionTrend, reportsTrend, flaggedTrend, dailySignups, dailyActive,
                sessionStatusDistribution, verificationDistribution,
                topSkills, topMentors, topLearners, recentActivity, platformHealth,
                new AdminHealthMetrics(totalUsers, totalMentors, totalLearners, totalSessions,
                        totalBookings, completedSessionCount, completionRate, activeUsers7d,
                        mentorRatio, joinedToday, joinedThisWeek, platformFees, totalReleasedAmount,
                        verifiedMentors, pendingVerifications, totalSkills, cancelledSessions,
                        pendingRequests, activeConversations, openReports, flaggedContent,
                        totalPayments, monthlyRevenue));

        return new ApiResponse<>("Dashboard data fetched", dashboard);
    }

    /**
     * Converts a native DATE() result column into a LocalDate, tolerating both
     * {@code java.sql.Date} (typical JDBC) and {@code java.time.LocalDate}
     * (some Hibernate 6 / driver configurations).
     */
    private static java.time.LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof java.time.LocalDate localDate) {
            return localDate;
        }
        return null;
    }

    /**
     * Merges the most recent platform events (signups, completed sessions,
     * payments, reports, flagged content, admin actions) into one newest-first
     * timeline for the admin dashboard.
     */
    private List<AdminActivityDto> buildRecentActivity() {
        List<AdminActivityDto> events = new ArrayList<>();
        try {
            for (User u : userRepository.findTop5ByOrderByCreatedAtDesc()) {
                events.add(new AdminActivityDto("SIGNUP", u.getRole() + " joined",
                        u.getEmail(), u.getFullName(), u.getCreatedAt()));
            }
            for (Booking b : bookingRepository
                    .findTop5ByBookingStatusOrderByCreatedAtDesc(BookingStatus.COMPLETED)) {
                String title = b.getSession() != null ? b.getSession().getTitle() : "Session";
                String learner = b.getLearner() != null ? b.getLearner().getFullName() : "Learner";
                events.add(new AdminActivityDto("COMPLETED", "Session completed",
                        title, learner, b.getCreatedAt()));
            }
            for (Payment p : paymentRepository.findTop5ByOrderByCreatedAtDesc()) {
                events.add(new AdminActivityDto("PAYMENT", "Payment " + p.getStatus(),
                        p.getCurrency() + " " + p.getAmount(), null, p.getCreatedAt()));
            }
            for (UserReport r : reportRepository.findTop5ByOrderByCreatedAtDesc()) {
                events.add(new AdminActivityDto("REPORT", "Report #" + r.getId(),
                        r.getReason(),
                        r.getReporter() != null ? r.getReporter().getFullName() : null,
                        r.getCreatedAt()));
            }
            for (FlaggedContent f : flaggedContentRepository.findTop5ByOrderByCreatedAtDesc()) {
                events.add(new AdminActivityDto("FLAGGED", "Content flagged",
                        (f.getContentType() != null ? f.getContentType() : "Content") + ": " + f.getReason(),
                        f.getOwner() != null ? f.getOwner().getFullName() : null,
                        f.getCreatedAt()));
            }
            for (AuditLog log : auditLogRepository.findTop10ByOrderByCreatedAtDesc()) {
                events.add(new AdminActivityDto("ADMIN", log.getAction(),
                        log.getDetails(), log.getAdminEmail(), log.getCreatedAt()));
            }
        } catch (Exception ignored) {
            // Recent activity must never fail the dashboard.
        }
        events.sort((a, b) -> b.createdAt().compareTo(a.createdAt()));
        return events.stream().limit(12).collect(Collectors.toList());
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
            String username = referrerUser != null ? referrerUser.getDisplayUsername() : "";
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
        // Seed every known preference from the catalog (stored rows win; new
        // keys default to enabled so admins opt out rather than opt in).
        for (String key : PlatformSettingsCatalog.NOTIFICATION_PREFS.keySet()) {
            result.putIfAbsent(key, true);
        }
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
        // Seed catalog defaults so the PUT response matches the GET shape.
        for (String key : PlatformSettingsCatalog.NOTIFICATION_PREFS.keySet()) {
            result.putIfAbsent(key, true);
        }
        return new ApiResponse<>("Preferences updated", result);
    }

    // ════════════════════════════════════════════════
    //  Audit helper
    // ════════════════════════════════════════════════

    private void saveAuditLog(User admin, String action, String entityType, Long entityId, String details) {
        saveAuditLog(admin, action, entityType, entityId, details, null, null);
    }

    private void saveAuditLog(User admin, String action, String entityType, Long entityId, String details,
            String beforeValue, String afterValue) {
        try {
            AuditLog log = new AuditLog();
            log.setAdminId(admin.getId());
            log.setAdminEmail(admin.getEmail());
            log.setAction(action);
            log.setEntityType(entityType);
            log.setEntityId(entityId);
            log.setDetails(details);
            log.setSeverity(AuditLogService.inferSeverity(action));
            log.setModule(AuditLogService.inferModule(action));
            log.setBeforeValue(beforeValue);
            log.setAfterValue(afterValue);
            log.setIpAddress(AuditLogService.extractClientIp());
            auditLogRepository.save(log);
        } catch (Exception ignored) {
            LOG.warn("Failed to save audit log", ignored);
        }
    }

    // ════════════════════════════════════════════════
    //  Admin — Health Monitoring (rich monitoring dashboard)
    // ════════════════════════════════════════════════

    /**
     * Full platform-health payload for the monitoring dashboard — system (JVM),
     * database, API, microservice, queue, security, error, activity, alert,
     * chart, and log metrics. All values are real; the health endpoint itself
     * is a read-only observer.
     */
    @GetMapping("/health")
    @Transactional(readOnly = true)
    public ApiResponse<MonitoringDtos.AdminHealthDto> getPlatformHealth(
            @AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);
        MonitoringDtos.AdminHealthDto health = systemHealthService.getPlatformHealth();
        // Append a sampled snapshot so the live charts accumulate real history
        // as the auto-refreshing dashboard polls this endpoint.
        systemHealthService.recordHealthSample(health);
        return new ApiResponse<>("Health data fetched", health);
    }

    /**
     * Paginated, searchable log viewer fed by real captured Logback events.
     * Supports level filtering (INFO / WARN / ERROR / DEBUG) and free-text
     * search against message + service.
     */
    @GetMapping("/health/logs")
    public ApiResponse<Page<LogBufferService.LogEntry>> getHealthLogs(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        ensureAdmin(currentUser);
        int page = Math.max(0, pageable.getPageNumber());
        int size = Math.min(Math.max(1, pageable.getPageSize()), 200);
        int limit = (page + 1) * size;
        List<LogBufferService.LogEntry> filtered = systemHealthService.recentLogs(level, q, limit);
        // True filtered total (not capped by the fetch limit) so the pager shows
        // every page of matching logs.
        long totalElements = systemHealthService.countLogs(level, q);

        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        List<LogBufferService.LogEntry> slice = filtered.subList(from, to);
        return new ApiResponse<>("Logs fetched",
                new PageImpl<>(slice, PageRequest.of(page, size), totalElements));
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

    private static boolean contains(String value, String lower) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(lower);
    }

    /** Loads a report that exists and is not soft-deleted. */
    private UserReport findActiveReport(Long id) {
        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        if (report.getDeletedAt() != null) {
            throw new IllegalArgumentException("Report not found");
        }
        return report;
    }

    /**
     * Parses a {@code yyyy-MM-dd} filter into an OffsetDateTime (UTC). When
     * {@code endOfDay} is true the returned instant covers the whole day, which
     * is what the "to" bound of a date-range filter needs.
     */
    private static OffsetDateTime parseReportDate(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            // Use the JVM default zone offset so day boundaries match how
            // createdAt is stored (OffsetDateTime.now() uses the local offset).
            java.time.ZoneId zone = java.time.ZoneId.systemDefault();
            java.time.LocalDate date = java.time.LocalDate.parse(value.trim());
            return endOfDay
                    ? date.atTime(java.time.LocalTime.MAX).atZone(zone).toOffsetDateTime()
                    : date.atStartOfDay().atZone(zone).toOffsetDateTime();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date '" + value + "'. Use yyyy-MM-dd.");
        }
    }

    /** Maps a report to the admin-facing DTO (flattened, user info included). */
    private static AdminReportDto toReportDto(UserReport r) {
        User reporter = r.getReporter();
        User reported = r.getReported();
        User admin = r.getAssignedAdmin();
        return new AdminReportDto(
                r.getId(),
                reporter != null ? reporter.getId() : null,
                reporter != null ? reporter.getFullName() : null,
                reporter != null ? reporter.getEmail() : null,
                reporter != null ? reporter.getDisplayUsername() : null,
                reported != null ? reported.getId() : null,
                reported != null ? reported.getFullName() : null,
                reported != null ? reported.getEmail() : null,
                reported != null ? reported.getDisplayUsername() : null,
                reported != null ? reported.isEnabled() : null,
                r.getTargetType(), r.getTargetId(), r.getTargetLabel(),
                r.getReason(), r.getDetails(),
                r.getPriority(), r.getStatus(),
                admin != null ? admin.getId() : null,
                admin != null ? admin.getFullName() : null,
                r.getModeratorNote(), r.getInternalNotes(),
                r.isEscalated(), r.getEscalationLevel(), r.getEscalationReason(), r.getEscalatedAt(),
                r.getCreatedAt(), r.getUpdatedAt());
    }

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
            List<MonthlyBucket> sessionTrend, List<MonthlyBucket> completionTrend,
            List<MonthlyBucket> reportsTrend, List<MonthlyBucket> flaggedTrend,
            List<DailyBucket> dailySignups, List<DailyBucket> dailyActive,
            List<AdminNameCountDto> sessionStatusDistribution,
            List<AdminNameCountDto> verificationDistribution,
            List<AdminTopSkillDto> topSkills, List<AdminTopMentorDto> topMentors,
            List<AdminTopLearnerDto> topLearners,
            List<AdminActivityDto> recentActivity,
            AdminPlatformHealthDto platformHealth,
            AdminHealthMetrics health) {}

    public record DailyBucket(String label, long value) {}

    public record AdminNameCountDto(String name, long count) {}

    public record AdminTopSkillDto(String name, long count) {}

    public record AdminTopMentorDto(Long mentorId, String name, String username, long bookingCount) {}

    public record AdminTopLearnerDto(Long learnerId, String name, String username, long bookingCount) {}

    public record AdminActivityDto(String type, String title, String detail, String actorName,
            java.time.OffsetDateTime createdAt) {}

    public record AdminPlatformHealthDto(String backendStatus, String databaseStatus,
            long apiResponseTimeMs, long storageUsageMb, long errorRate24h,
            long notificationQueueToday, long emailQueueToday) {}

    public record AdminHealthMetrics(long totalUsers, long totalMentors, long totalLearners,
            long totalSessions, long totalBookings, long completedSessions, double completionRate,
            long activeUsers7d, double mentorRatio, long joinedToday, long joinedThisWeek,
            double platformFees, double totalReleasedAmount,
            long verifiedMentors, long pendingVerifications, long totalSkills,
            long cancelledSessions, long pendingRequests, long activeConversations,
            long openReports, long flaggedContent, long totalPayments, double monthlyRevenue) {}

    public record AdminSummary(long totalUsers, long learners, long mentors, long admins,
            long openReports, long pendingMentorVerifications) {}
    public record ReportDecisionRequest(@NotNull ReportStatus status, String note, Boolean suspendUser) {}
    public record ReportAssignRequest(Long adminId) {}
    public record ReportStatusRequest(ReportStatus status) {}
    public record ReportPriorityRequest(@NotNull ReportPriority priority) {}
    public record ReportNoteRequest(String note) {}

    /** Admin queue + detail DTO — everything the reports page needs in one shape. */
    public record AdminReportDto(
            Long id,
            Long reporterId, String reporterName, String reporterEmail, String reporterUsername,
            Long reportedUserId, String reportedName, String reportedEmail, String reportedUsername,
            Boolean reportedEnabled,
            String targetType, Long targetId, String targetLabel,
            String reason, String details,
            ReportPriority priority, ReportStatus status,
            Long assignedAdminId, String assignedAdminName,
            String moderatorNote, String internalNotes,
            boolean escalated, Integer escalationLevel, String escalationReason, OffsetDateTime escalatedAt,
            OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

    /** Real DB counts for the reports dashboard. */
    public record AdminReportStatsDto(long total, long open, long inReview, long resolved, long rejected,
            long suspendedUsers) {}
    public record UserEnabledRequest(boolean enabled) {}
    public record AdminSubRoleRequest(@NotNull AdminSubRole adminSubRole) {}
    public record AdminSettingsDto(java.util.Map<String, String> settings) {}
    public record AdminSettingsCategoryDto(String id, String label, String description,
            List<AdminSettingFieldDto> fields) {}
    public record AdminSettingFieldDto(String key, String type, String label, String description,
            String value, List<String> options) {}
    public record AdminSettingsResetRequest(String category) {}
    public record AdminReportScheduleRequest(@NotBlank @jakarta.validation.constraints.Pattern(regexp = "^(none|weekly|monthly)$", message = "Frequency must be none, weekly, or monthly") String frequency) {}

    // Conversation DTOs
    public record AdminConversationDto(String id, String kind, Long referenceId, String participantName,
            String sessionTitle, String status, String lastMessagePreview, OffsetDateTime lastActivityAt,
            Long participantOneId, String participantOneName, String participantOneUsername, String participantOneEmail,
            Long participantTwoId, String participantTwoName, String participantTwoUsername, String participantTwoEmail,
            long unreadCount) {}
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
            Integer maxParticipants, int participantCount, int bookingCount, OffsetDateTime createdAt) {}
    public record AdminSessionStatusRequest(@NotNull SessionStatus status) {}

    // Notification DTOs
    public record AdminBroadcastRequest(
            @NotBlank String title,
            @NotBlank String message,
            String targetRole,
            String type) {}

    /** Notification & Broadcast Center — create/edit request. */
    public record AdminNotificationCreateRequest(
            @NotBlank String title,
            String subtitle,
            @NotBlank String message,
            String type,
            String priority,
            String targetScope,
            String targetDetail,
            OffsetDateTime scheduleTime,
            OffsetDateTime expiresAt,
            String repeatType,
            String actionButtonText,
            String actionUrl,
            Boolean sendNow) {}

    /** Notification & Broadcast Center — history/detail row. */
    public record NotificationBroadcastDto(
            Long id, String title, String subtitle, String message,
            String type, String priority, String status,
            String targetScope, String targetDetail,
            OffsetDateTime scheduleTime, OffsetDateTime sentAt, OffsetDateTime expiresAt,
            String repeatType, String actionButtonText, String actionUrl,
            int totalTargets, int deliveredCount, int readCount, int clickedCount, int failedCount,
            String createdByName, OffsetDateTime createdAt,
            OffsetDateTime cancelledAt, OffsetDateTime archivedAt) {}

    // Audit Log DTOs
    public record AdminAuditLogDto(Long id, Long adminId, String adminEmail, String action,
            String entityType, Long entityId, String details, OffsetDateTime createdAt,
            String ipAddress, Long userId, String resource, Long resourceId,
            String severity, String module, String outcome, String beforeValue, String afterValue,
            String userAgent, String device, String browser, String os,
            String requestId, String correlationId, String endpoint, OffsetDateTime archivedAt) {}

    public record NameCountDto(String label, long count) {}

    public record AdminAuditStatsDto(long totalLogs, long todayActivities, long last24h,
            long securityEvents24h, long failedLogins24h, long adminActions30d, long userActions30d,
            long warnings24h, long critical24h, double successRate,
            List<NameCountDto> bySeverity, List<NameCountDto> byModule, List<NameCountDto> dailyTrend) {}

    public record AlertGroupDto(String key, long count) {}

    public record AdminSecurityAlertsDto(long totalAlerts,
            List<AlertGroupDto> repeatedFailedLogins, List<AlertGroupDto> repeatedPasswordResets,
            List<AlertGroupDto> repeatedAccountDisables,
            List<AdminAuditLogDto> privilegeChanges, List<AdminAuditLogDto> recentErrors) {}

    public record AuditRetentionRequest(@NotNull Integer days) {}

    // Moderation DTOs
    public record AdminModerationRequest(@NotNull ReportStatus status, String note) {}

    // Health DTOs

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
