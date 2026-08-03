package com.skillswap.moderation;

import com.skillswap.common.AuditLogService;
import com.skillswap.moderation.detection.ModerationScanner;
import com.skillswap.notification.NotificationService;
import com.skillswap.safety.ReportPriority;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Core moderation workflow. Every mutating action records a timeline event,
 * writes an audit log entry, and (where relevant) notifies the affected user.
 */
/**
 * Service implementing content moderation business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentModerationService {

    private final FlaggedContentRepository flaggedContentRepository;
    private final ModerationEventRepository eventRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final ModerationScanner moderationScanner;

    // ── Query ────────────────────────────────────────────────────

    public Page<FlaggedContent> findQueue(
            ModerationStatus status, ContentType contentType, ReportPriority priority,
            DetectionSource detectionSource, Long reporterId, Long ownerId,
            OffsetDateTime fromDate, OffsetDateTime toDate, String q,
            int page, int size, String sortBy, String sortDir) {

        String sortField = switch (sortBy == null ? "createdAt" : sortBy.toLowerCase()) {
            case "id" -> "id";
            case "contenttype" -> "contentType";
            case "priority" -> "priority";
            case "status" -> "status";
            case "detectionsource" -> "detectionSource";
            default -> "createdAt";
        };
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(size, 100),
                Sort.by(direction, sortField));

        return flaggedContentRepository.findByFilters(
                status, contentType, priority, detectionSource, reporterId, ownerId,
                fromDate, toDate, q, pageable);
    }

    public FlaggedContent findById(Long id) {
        // findWithDetailsById uses @EntityGraph so owner / reporter / moderator
        // are initialized here — the controller maps to DTOs outside the repo tx.
        FlaggedContent item = flaggedContentRepository.findWithDetailsById(id)
                .orElseThrow(() -> new IllegalArgumentException("Flagged content not found"));
        if (item.getDeletedAt() != null) {
            throw new IllegalArgumentException("Flagged content not found");
        }
        return item;
    }

    public List<ModerationEvent> timeline(Long id) {
        findById(id); // ensure it exists and is not soft-deleted
        return eventRepository.findByFlaggedContentIdOrderByCreatedAtAsc(id);
    }

    public Map<String, Long> stats() {
        Map<String, Long> stats = new HashMap<>();
        long total = 0;
        for (Object[] row : flaggedContentRepository.countGroupedByStatus()) {
            ModerationStatus status = (ModerationStatus) row[0];
            long count = ((Number) row[1]).longValue();
            total += count;
            stats.put(status.name(), count);
        }
        stats.put("total", total);

        for (Object[] row : flaggedContentRepository.countGroupedByPriority()) {
            ReportPriority priority = (ReportPriority) row[0];
            stats.put("priority_" + priority.name(), ((Number) row[1]).longValue());
        }

        OffsetDateTime startOfDay = OffsetDateTime.now()
                .withHour(0).withMinute(0).withSecond(0).withNano(0);
        stats.put("decidedToday", flaggedContentRepository.countDecidedSince(
                List.of(ModerationStatus.APPROVED, ModerationStatus.REMOVED,
                        ModerationStatus.DISMISSED, ModerationStatus.RESTORED),
                startOfDay));
        return stats;
    }

    // ── Flag creation ────────────────────────────────────────────

    @Transactional
    public FlaggedContent flag(
            ContentType contentType, Long contentId, String contentPreview,
            User owner, User reporter, DetectionSource source, String reason,
            ReportPriority priority, Double aiConfidence) {
        if (contentType == null) {
            throw new IllegalArgumentException("Content type is required");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("A reason is required");
        }

        FlaggedContent item = new FlaggedContent();
        item.setContentType(contentType);
        item.setContentId(contentId);
        item.setContentPreview(truncate(contentPreview, 2000));
        item.setOwner(owner);
        item.setReporter(reporter);
        item.setDetectionSource(source == null ? DetectionSource.MANUAL_REPORT : source);
        item.setReason(reason.trim());
        item.setPriority(priority == null ? ReportPriority.MEDIUM : priority);
        item.setAiConfidence(aiConfidence);
        item.setStatus(ModerationStatus.PENDING_REVIEW);

        FlaggedContent saved = flaggedContentRepository.save(item);
        recordEvent(saved, "FLAGGED", null, ModerationStatus.PENDING_REVIEW,
                "Flagged via " + item.getDetectionSource());

        // Auto-escalate high-risk signals straight into investigation.
        if (item.getDetectionSource() == DetectionSource.AI_MODERATION
                && aiConfidence != null && aiConfidence >= 0.9) {
            saved = assignAndEscalate(saved, null, 1, "High-confidence AI flag");
        }
        return saved;
    }

    /**
     * Runs the detection pipeline over content and, if a detector fires,
     * creates a flagged item for it. Returns the created item or {@code null}.
     * The primary source is the strongest firing detector.
     */
    @Transactional
    public FlaggedContent scanAndFlag(
            ContentType contentType, Long contentId, String contentPreview,
            User owner, DetectionSource forcedSource) {
        ModerationScanner.ScanOutcome outcome = moderationScanner.scanOutcome(contentPreview);
        if (outcome == null || !outcome.flagged()) {
            return null;
        }
        DetectionSource source = forcedSource != null ? forcedSource : outcome.source();
        return flag(contentType, contentId, contentPreview, owner, null,
                source, outcome.reason(), ReportPriority.HIGH, outcome.confidence());
    }

    // ── Moderator actions ────────────────────────────────────────

    @Transactional
    public FlaggedContent assign(User moderator, Long itemId, Long moderatorId) {
        FlaggedContent item = findById(itemId);
        User assignee = moderatorId != null
                ? userRepository.findById(moderatorId)
                        .orElseThrow(() -> new IllegalArgumentException("Moderator not found"))
                : moderator;
        if (assignee.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Can only assign moderation to admins");
        }
        ModerationStatus from = item.getStatus();
        item.setAssignedModerator(assignee);
        if (item.getStatus() == ModerationStatus.PENDING_REVIEW) {
            item.setStatus(ModerationStatus.UNDER_INVESTIGATION);
        }
        item.setUpdatedAt(OffsetDateTime.now());
        FlaggedContent saved = flaggedContentRepository.save(item);
        recordEvent(saved, "ASSIGNED", from, saved.getStatus(),
                "Assigned to " + assignee.getFullName());
        auditLogService.logAdmin(moderator, "ASSIGN_MODERATION", "FlaggedContent", itemId,
                "Assigned item #" + itemId + " to " + assignee.getFullName());
        return saved;
    }

    @Transactional
    public FlaggedContent escalate(User moderator, Long itemId, int level, String reason) {
        FlaggedContent item = findById(itemId);
        ModerationStatus from = item.getStatus();
        item.setEscalationLevel(Math.max(1, Math.min(5, level)));
        item.setEscalationReason(reason);
        item.setEscalatedAt(OffsetDateTime.now());
        if (item.getStatus() == ModerationStatus.PENDING_REVIEW) {
            item.setStatus(ModerationStatus.UNDER_INVESTIGATION);
        }
        item.setUpdatedAt(OffsetDateTime.now());
        FlaggedContent saved = flaggedContentRepository.save(item);
        recordEvent(saved, "ESCALATED", from, saved.getStatus(),
                "Escalated to level " + level + (reason == null ? "" : " — " + reason));
        auditLogService.logAdmin(moderator, "ESCALATE_MODERATION", "FlaggedContent", itemId,
                "Escalated to level " + level + (reason == null ? "" : " — " + reason));
        return saved;
    }

    @Transactional
    public FlaggedContent addNote(User moderator, Long itemId, String note) {
        if (note == null || note.isBlank()) {
            throw new IllegalArgumentException("A note is required");
        }
        FlaggedContent item = findById(itemId);
        String existing = item.getInternalNotes();
        String entry = OffsetDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                + " · " + moderator.getFullName() + ": " + note.trim();
        item.setInternalNotes(existing == null || existing.isBlank() ? entry : existing + "\n" + entry);
        item.setUpdatedAt(OffsetDateTime.now());
        FlaggedContent saved = flaggedContentRepository.save(item);
        recordEvent(saved, "NOTE_ADDED", null, null, note.trim());
        auditLogService.logAdmin(moderator, "ADD_MODERATION_NOTE", "FlaggedContent", itemId,
                "Added note: " + note.trim());
        return saved;
    }

    @Transactional
    public FlaggedContent decide(User moderator, Long itemId, ModerationStatus target, String note) {
        if (target == ModerationStatus.APPROVED || target == ModerationStatus.REMOVED
                || target == ModerationStatus.DISMISSED || target == ModerationStatus.RESTORED) {
            return transition(moderator, itemId, target, note);
        }
        throw new IllegalArgumentException("Unsupported decision status: " + target);
    }

    /** Approves the content (allowed to stay) and notifies the owner. */
    @Transactional
    public FlaggedContent approve(User moderator, Long itemId, String note) {
        FlaggedContent saved = transition(moderator, itemId, ModerationStatus.APPROVED, note);
        notifyOwner(saved, "CONTENT_APPROVED", "Content approved",
                "Your content was reviewed and approved. No action needed.");
        return saved;
    }

    /** Removes the content and notifies the owner. */
    @Transactional
    public FlaggedContent remove(User moderator, Long itemId, String note) {
        FlaggedContent saved = transition(moderator, itemId, ModerationStatus.REMOVED, note);
        notifyOwner(saved, "CONTENT_REMOVED", "Content removed",
                "Your content was removed for violating our guidelines."
                        + (note == null ? "" : " Reason: " + note));
        return saved;
    }

    /** Restores previously removed content and notifies the owner. */
    @Transactional
    public FlaggedContent restore(User moderator, Long itemId, String note) {
        FlaggedContent saved = transition(moderator, itemId, ModerationStatus.RESTORED, note);
        notifyOwner(saved, "CONTENT_RESTORED", "Content restored",
                "Your content was restored after review.");
        return saved;
    }

    @Transactional
    public FlaggedContent warnUser(User moderator, Long itemId, String warning) {
        if (warning == null || warning.isBlank()) {
            throw new IllegalArgumentException("A warning message is required");
        }
        FlaggedContent item = findById(itemId);
        if (item.getOwner() == null) {
            throw new IllegalArgumentException("This flagged item has no owner to warn");
        }
        User owner = item.getOwner();
        try {
            notificationService.notifyUser(owner.getId(), "MODERATION_WARNING",
                    "Community warning",
                    warning.trim() + " — repeated violations may lead to suspension.",
                    item.getId());
        } catch (Exception ignored) {
            // Notification failure must never fail the moderation action.
        }
        item.setUpdatedAt(OffsetDateTime.now());
        FlaggedContent saved = flaggedContentRepository.save(item);
        recordEvent(saved, "WARNED", null, null, warning.trim());
        auditLogService.logAdmin(moderator, "WARN_USER", "FlaggedContent", itemId,
                "Warned user " + owner.getEmail() + ": " + warning.trim());
        return saved;
    }

    /** Suspends or restores the owner's account with notification + audit. */
    @Transactional
    public FlaggedContent setOwnerEnabled(User moderator, Long itemId, boolean enabled) {
        FlaggedContent item = findById(itemId);
        User owner = item.getOwner();
        if (owner == null) {
            throw new IllegalArgumentException("This flagged item has no owner to suspend or restore");
        }
        if (owner.getId().equals(moderator.getId())) {
            throw new IllegalArgumentException("Admins cannot change their own account");
        }
        if (owner.isEnabled() == enabled) {
            throw new IllegalArgumentException("Account is already " + (enabled ? "enabled" : "suspended"));
        }
        owner.setEnabled(enabled);
        userRepository.save(owner);
        item.setUpdatedAt(OffsetDateTime.now());
        FlaggedContent saved = flaggedContentRepository.save(item);

        recordEvent(saved, enabled ? "RESTORED" : "SUSPENDED", null, null,
                (enabled ? "Account restored" : "Account suspended") + " — " + owner.getEmail());
        auditLogService.logAdmin(moderator, enabled ? "UNSUSPEND_USER" : "SUSPEND_USER",
                "FlaggedContent", itemId,
                (enabled ? "Restored account \"" : "Suspended account \"") + owner.getFullName()
                        + "\" via flagged content #" + itemId);

        try {
            notificationService.notifyUser(owner.getId(),
                    enabled ? "ACCOUNT_RESTORED" : "ACCOUNT_SUSPENDED",
                    enabled ? "Account restored" : "Account suspended",
                    enabled
                            ? "Your account has been restored. You can sign in again."
                            : "Your account was suspended after a review. Contact support for details.",
                    itemId);
        } catch (Exception ignored) {
            // Notification failure must never fail the moderation action.
        }
        return saved;
    }

    /** Permanently deletes the flagged item and its timeline from the database. */
    @Transactional
    public void deletePermanently(User moderator, Long itemId, String note) {
        FlaggedContent item = findById(itemId);
        auditLogService.logAdmin(moderator, "DELETE_FLAGGED_CONTENT", "FlaggedContent", itemId,
                "Permanently deleted flagged content #" + itemId
                        + (note == null ? "" : " — " + note));
        flaggedContentRepository.delete(item);
    }

    // ── Internal helpers ─────────────────────────────────────────

    private FlaggedContent transition(User moderator, Long itemId, ModerationStatus target, String note) {
        FlaggedContent item = findById(itemId);
        ModerationStatus from = item.getStatus();
        if (from == target) {
            throw new IllegalArgumentException("Item is already " + target.name());
        }
        item.setStatus(target);
        item.setUpdatedAt(OffsetDateTime.now());
        FlaggedContent saved = flaggedContentRepository.save(item);
        recordEvent(saved, target.name(), from, target, note);
        auditLogService.logAdmin(moderator, "MODERATE_CONTENT", "FlaggedContent", itemId,
                "Moved item #" + itemId + " from " + from + " to " + target
                        + (note == null ? "" : " — " + note));
        return saved;
    }

    private FlaggedContent assignAndEscalate(FlaggedContent item, User assignee, int level, String reason) {
        FlaggedContent saved = item;
        if (assignee != null) {
            saved.setAssignedModerator(assignee);
        }
        saved.setEscalationLevel(level);
        saved.setEscalationReason(reason);
        saved.setEscalatedAt(OffsetDateTime.now());
        saved.setStatus(ModerationStatus.UNDER_INVESTIGATION);
        saved.setUpdatedAt(OffsetDateTime.now());
        saved = flaggedContentRepository.save(saved);
        recordEvent(saved, "ESCALATED", ModerationStatus.PENDING_REVIEW,
                ModerationStatus.UNDER_INVESTIGATION, reason);
        return saved;
    }

    private void recordEvent(FlaggedContent item, String action, ModerationStatus from,
            ModerationStatus to, String note) {
        try {
            ModerationEvent event = new ModerationEvent();
            event.setFlaggedContent(item);
            event.setAction(action);
            event.setFromStatus(from == null ? null : from.name());
            event.setToStatus(to == null ? null : to.name());
            event.setNote(note);
            eventRepository.save(event);
        } catch (Exception ignored) {
            // Timeline recording must never fail the moderation action.
        }
    }

    private void notifyOwner(FlaggedContent item, String type, String title, String message) {
        try {
            if (item.getOwner() != null && item.getOwner().getId() != null) {
                notificationService.notifyUser(item.getOwner().getId(), type, title, message, item.getId());
            }
        } catch (Exception ignored) {
            // Notification failure must never fail the moderation action.
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
