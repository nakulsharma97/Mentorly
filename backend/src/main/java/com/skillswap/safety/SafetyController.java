package com.skillswap.safety;

import com.skillswap.common.ApiResponse;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/safety")
@RequiredArgsConstructor
public class SafetyController {

    private final UserBlockRepository blockRepository;
    private final UserReportRepository reportRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @PostMapping("/block/{userId}")
    public ApiResponse<UserBlock> blockUser(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long userId,
            @RequestBody(required = false) BlockRequest req) {
        if (currentUser.getId().equals(userId)) {
            throw new IllegalArgumentException("You cannot block yourself");
        }
        if (blockRepository.existsByBlockerIdAndBlockedId(currentUser.getId(), userId)) {
            throw new IllegalArgumentException("User is already blocked");
        }

        User blocked = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        UserBlock block = new UserBlock();
        block.setBlocker(currentUser);
        block.setBlocked(blocked);
        block.setReason(req == null ? null : req.reason());
        return new ApiResponse<>("User blocked", blockRepository.save(block));
    }

    @DeleteMapping("/block/{userId}")
    public ApiResponse<Boolean> unblockUser(@AuthenticationPrincipal User currentUser, @PathVariable Long userId) {
        UserBlock block = blockRepository.findByBlockerIdAndBlockedId(currentUser.getId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("User is not blocked"));
        blockRepository.delete(block);
        return new ApiResponse<>("User unblocked", true);
    }

    @GetMapping("/blocked")
    public ApiResponse<List<UserBlock>> blockedUsers(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Blocked users fetched", blockRepository.findByBlockerId(currentUser.getId()));
    }

    @PostMapping("/report")
    public ApiResponse<UserReport> reportUser(
            @AuthenticationPrincipal User currentUser,
            @RequestBody CreateReportRequest req) {
        if (currentUser.getId().equals(req.reportedUserId())) {
            throw new IllegalArgumentException("You cannot report yourself");
        }
        User reported = userRepository.findById(req.reportedUserId())
                .orElseThrow(() -> new IllegalArgumentException("Reported user not found"));

        UserReport report = new UserReport();
        report.setReporter(currentUser);
        report.setReported(reported);
        report.setTargetType(req.targetType());
        report.setTargetId(req.targetId());
        report.setReason(req.reason());
        report.setDetails(req.details());
        report.setStatus(ReportStatus.OPEN);

        UserReport saved = reportRepository.save(report);
        notificationService.notifyUser(
                reported.getId(),
                "SAFETY_REPORT",
                "A report was filed",
                "A report involving your account was submitted and is under review.",
                saved.getId());

        return new ApiResponse<>("Report submitted", saved);
    }

    @GetMapping("/reports")
    public ApiResponse<List<UserReport>> reports(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "false") boolean moderationQueue,
            @RequestParam(defaultValue = "OPEN") ReportStatus status) {
        if (moderationQueue) {
            ensureAdmin(currentUser);
            return new ApiResponse<>("Moderation queue fetched",
                    reportRepository.findByStatusOrderByCreatedAtAsc(status));
        }
        return new ApiResponse<>("Your reports fetched",
                reportRepository.findByReporterIdOrderByCreatedAtDesc(currentUser.getId()));
    }

    @PatchMapping("/reports/{id}")
    public ApiResponse<UserReport> updateReportStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateReportStatusRequest req) {
        ensureAdmin(currentUser);
        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        report.setStatus(req.status());
        report.setUpdatedAt(OffsetDateTime.now());

        UserReport saved = reportRepository.save(report);
        notificationService.notifyUser(
                saved.getReporter().getId(),
                "SAFETY_UPDATE",
                "Report status updated",
                "Your report status is now " + saved.getStatus().name(),
                saved.getId());
        return new ApiResponse<>("Report status updated", saved);
    }

    @PatchMapping("/reports/{id}/escalate")
    public ApiResponse<UserReport> escalateReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody EscalateReportRequest req) {
        ensureAdmin(currentUser);

        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        int level = req.level() == null ? 1 : Math.max(1, Math.min(5, req.level()));

        report.setEscalated(true);
        report.setEscalationLevel(level);
        report.setEscalationReason(req.reason());
        report.setEscalatedAt(OffsetDateTime.now());
        report.setStatus(ReportStatus.IN_REVIEW);
        report.setUpdatedAt(OffsetDateTime.now());

        UserReport saved = reportRepository.save(report);
        notificationService.notifyUser(
                saved.getReporter().getId(),
                "SAFETY_UPDATE",
                "Report escalated",
                "Your report was escalated to level " + level + " and is now under priority review.",
                saved.getId());

        return new ApiResponse<>("Report escalated", saved);
    }

    private static void ensureAdmin(User currentUser) {
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only admins can perform moderation actions");
        }
    }

    public record BlockRequest(String reason) {
    }

    public record CreateReportRequest(Long reportedUserId, String targetType, Long targetId, String reason,
            String details) {
    }

    public record UpdateReportStatusRequest(ReportStatus status) {
    }

    public record EscalateReportRequest(Integer level, String reason) {
    }
}
