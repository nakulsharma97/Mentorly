package com.skillswap.safety;

import com.skillswap.common.ApiResponse;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.skill.Skill;
import com.skillswap.skill.SkillRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/v1/safety")
@RequiredArgsConstructor
public class SafetyController {

    /** Canonical report target types. */
    public static final String TYPE_MENTOR = "MENTOR";
    public static final String TYPE_LEARNER = "LEARNER";
    public static final String TYPE_SESSION = "SESSION";
    public static final String TYPE_SKILL = "SKILL";

    private final UserBlockRepository blockRepository;
    private final UserReportRepository reportRepository;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final SkillRepository skillRepository;
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

    /**
     * Reports a Mentor, Learner, Session, or Skill.
     *
     * <p>For user targets ({@code MENTOR} / {@code LEARNER}) the {@code reportedUserId}
     * must point at an existing user. For {@code SESSION} the {@code targetId} must be a
     * valid session id (its title becomes the label and its mentor the reported user, so
     * admins can act on the responsible account). For {@code SKILL} the {@code targetId}
     * must be a valid skill id — its name becomes the label and no user is reported.</p>
     */
    @PostMapping("/report")
    public ApiResponse<UserReport> reportUser(
            @AuthenticationPrincipal User currentUser,
            @RequestBody CreateReportRequest req) {
        String rawType = req.targetType() == null ? "" : req.targetType().trim().toUpperCase(Locale.ROOT);
        String type = switch (rawType) {
            case TYPE_MENTOR, TYPE_LEARNER, TYPE_SESSION, TYPE_SKILL -> rawType;
            default -> throw new IllegalArgumentException(
                    "Invalid target type. Use MENTOR, LEARNER, SESSION, or SKILL.");
        };

        User reported = null;
        String targetLabel = null;
        Long targetId = req.targetId();

        switch (type) {
            case TYPE_MENTOR, TYPE_LEARNER -> {
                if (req.reportedUserId() == null) {
                    throw new IllegalArgumentException("Reported user is required");
                }
                if (currentUser.getId().equals(req.reportedUserId())) {
                    throw new IllegalArgumentException("You cannot report yourself");
                }
                reported = userRepository.findById(req.reportedUserId())
                        .orElseThrow(() -> new IllegalArgumentException("Reported user not found"));
                if (TYPE_MENTOR.equals(type) && reported.getRole() != UserRole.MENTOR) {
                    throw new IllegalArgumentException("The reported user is not a mentor");
                }
                if (TYPE_LEARNER.equals(type) && reported.getRole() != UserRole.LEARNER) {
                    throw new IllegalArgumentException("The reported user is not a learner");
                }
                targetLabel = reported.getFullName();
                targetId = reported.getId();
            }
            case TYPE_SESSION -> {
                if (req.targetId() == null) {
                    throw new IllegalArgumentException("Session id is required");
                }
                SkillSession session = sessionRepository.findById(req.targetId())
                        .orElseThrow(() -> new IllegalArgumentException("Session not found"));
                targetLabel = session.getTitle();
                reported = session.getMentor();
            }
            case TYPE_SKILL -> {
                // Prefer the DB id when available; otherwise resolve by name so
                // catalog pages (which have no id handy) can still report a skill.
                if (req.targetId() != null) {
                    Skill skill = skillRepository.findById(req.targetId())
                            .orElseThrow(() -> new IllegalArgumentException("Skill not found"));
                    targetId = skill.getId();
                    targetLabel = skill.getName();
                } else {
                    if (req.targetLabel() == null || req.targetLabel().isBlank()) {
                        throw new IllegalArgumentException("Skill id or name is required");
                    }
                    Skill skill = skillRepository.findByNameIgnoreCase(req.targetLabel().trim())
                            .orElse(null);
                    if (skill != null) {
                        targetId = skill.getId();
                        targetLabel = skill.getName();
                    } else {
                        targetLabel = req.targetLabel().trim();
                    }
                }
            }
            default -> {
                // Unreachable — handled above.
            }
        }

        if (req.reason() == null || req.reason().isBlank()) {
            throw new IllegalArgumentException("A reason is required");
        }

        UserReport report = new UserReport();
        report.setReporter(currentUser);
        report.setReported(reported);
        report.setTargetType(type);
        report.setTargetId(targetId);
        report.setTargetLabel(targetLabel);
        report.setReason(req.reason().trim());
        report.setDetails(req.details());
        report.setStatus(ReportStatus.OPEN);

        UserReport saved = reportRepository.save(report);
        if (reported != null) {
            try {
                notificationService.notifyUser(
                        reported.getId(),
                        "SAFETY_REPORT",
                        "A report was filed",
                        "A report involving your account was submitted and is under review.",
                        saved.getId());
            } catch (Exception ignored) {
                // Notification failure must never block the report submission.
            }
        }

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

    /**
     * @param reportedUserId id of the reported user — required for MENTOR / LEARNER targets
     * @param targetType     MENTOR | LEARNER | SESSION | SKILL
     * @param targetId       session id for SESSION targets, skill id for SKILL targets (optional for SKILL by name)
     * @param targetLabel    display name used when reporting a skill by name (SKILL targets only)
     * @param reason         short reason for the report
     * @param details        optional free-text details
     */
    public record CreateReportRequest(Long reportedUserId, String targetType, Long targetId, String targetLabel,
            String reason, String details) {
    }

    public record UpdateReportStatusRequest(ReportStatus status) {
    }

    public record EscalateReportRequest(Integer level, String reason) {
    }
}
