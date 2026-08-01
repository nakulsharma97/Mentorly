package com.skillswap.moderation;

import com.skillswap.common.AdminUtils;
import com.skillswap.common.ApiResponse;
import com.skillswap.safety.ReportPriority;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Admin-only Content Moderation Center. Every endpoint requires ROLE_ADMIN
 * (sub-role MODERATOR or SUPER_ADMIN) and the whole surface is under
 * {@code /api/v1/admin/**}, which Spring Security already locks to admins.
 */
@RestController
@RequestMapping("/api/v1/admin/moderation")
@RequiredArgsConstructor
public class ContentModerationController {

    private final ContentModerationService moderationService;
    private final UserRepository userRepository;

    // ── Queue & stats ────────────────────────────────────────────

    @GetMapping
    public ApiResponse<Page<ModerationItemDto>> list(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) ModerationStatus status,
            @RequestParam(required = false) ContentType contentType,
            @RequestParam(required = false) ReportPriority priority,
            @RequestParam(required = false) DetectionSource detectionSource,
            @RequestParam(required = false) Long reporterId,
            @RequestParam(required = false) Long ownerId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        ensureModerator(currentUser);

        Page<FlaggedContent> result = moderationService.findQueue(
                status, contentType, priority, detectionSource, reporterId, ownerId,
                parseDate(fromDate, false), parseDate(toDate, true), q,
                page, size, sortBy, sortDir);

        return new ApiResponse<>("Flagged content fetched",
                result.map(ContentModerationController::toDto));
    }

    @GetMapping("/stats")
    public ApiResponse<Map<String, Long>> stats(@AuthenticationPrincipal User currentUser) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Moderation stats fetched", moderationService.stats());
    }

    @GetMapping("/{id}")
    public ApiResponse<ModerationItemDto> detail(
            @AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Flagged content fetched",
                toDto(moderationService.findById(id)));
    }

    @GetMapping("/{id}/events")
    public ApiResponse<List<ModerationEventDto>> events(
            @AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Moderation timeline fetched",
                moderationService.timeline(id).stream()
                        .map(e -> new ModerationEventDto(
                                e.getId(), e.getAction(),
                                e.getActor() != null ? e.getActor().getFullName() : "System",
                                e.getFromStatus(), e.getToStatus(), e.getNote(), e.getCreatedAt()))
                        .toList());
    }

    @GetMapping("/detection-sources")
    public ApiResponse<List<DetectionSource>> detectionSources(@AuthenticationPrincipal User currentUser) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Detection sources fetched", List.of(DetectionSource.values()));
    }

    // ── Moderation actions ───────────────────────────────────────

    @PostMapping("/{id}/assign")
    public ApiResponse<ModerationItemDto> assign(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) AssignRequest request) {
        ensureModerator(currentUser);
        Long moderatorId = request != null ? request.moderatorId() : null;
        return new ApiResponse<>("Item assigned",
                toDto(moderationService.assign(currentUser, id, moderatorId)));
    }

    @PostMapping("/{id}/escalate")
    public ApiResponse<ModerationItemDto> escalate(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody EscalateRequest request) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Item escalated",
                toDto(moderationService.escalate(currentUser, id,
                        request.level() == null ? 1 : request.level(), request.reason())));
    }

    @PostMapping("/{id}/notes")
    public ApiResponse<ModerationItemDto> addNote(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody NoteRequest request) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Note added",
                toDto(moderationService.addNote(currentUser, id, request.note())));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<ModerationItemDto> approve(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) NoteRequest request) {
        ensureModerator(currentUser);
        String note = request != null ? request.note() : null;
        return new ApiResponse<>("Content approved",
                toDto(moderationService.approve(currentUser, id, note)));
    }

    @PostMapping("/{id}/remove")
    public ApiResponse<ModerationItemDto> remove(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) NoteRequest request) {
        ensureModerator(currentUser);
        String note = request != null ? request.note() : null;
        return new ApiResponse<>("Content removed",
                toDto(moderationService.remove(currentUser, id, note)));
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<ModerationItemDto> restore(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) NoteRequest request) {
        ensureModerator(currentUser);
        String note = request != null ? request.note() : null;
        return new ApiResponse<>("Content restored",
                toDto(moderationService.restore(currentUser, id, note)));
    }

    @PostMapping("/{id}/dismiss")
    public ApiResponse<ModerationItemDto> dismiss(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) NoteRequest request) {
        ensureModerator(currentUser);
        String note = request != null ? request.note() : null;
        return new ApiResponse<>("Flag dismissed",
                toDto(moderationService.decide(currentUser, id, ModerationStatus.DISMISSED, note)));
    }

    @PostMapping("/{id}/warn")
    public ApiResponse<ModerationItemDto> warn(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody NoteRequest request) {
        ensureModerator(currentUser);
        return new ApiResponse<>("Warning issued",
                toDto(moderationService.warnUser(currentUser, id, request.note())));
    }

    @PostMapping("/{id}/user-enabled")
    public ApiResponse<ModerationItemDto> setUserEnabled(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody UserEnabledRequest request) {
        ensureModerator(currentUser);
        return new ApiResponse<>(request.enabled() ? "User restored" : "User suspended",
                toDto(moderationService.setOwnerEnabled(currentUser, id, request.enabled())));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, String>> deletePermanently(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody(required = false) NoteRequest request) {
        ensureModerator(currentUser);
        String note = request != null ? request.note() : null;
        moderationService.deletePermanently(currentUser, id, note);
        return new ApiResponse<>("Flagged content permanently deleted",
                Map.of("deletedItemId", String.valueOf(id)));
    }

    // ── Auto-detection entry point (AI-ready) ────────────────────

    /**
     * Runs the detection pipeline over the provided content and, when a
     * detector fires, creates a flagged item. Used by the moderation center
     * to re-scan content and by automated jobs. Returns the created item or
     * {@code null} when nothing is flagged.
     */
    @PostMapping("/scan")
    public ApiResponse<ModerationItemDto> scanContent(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ScanRequest request) {
        ensureModerator(currentUser);
        ContentType type = ContentType.valueOf(request.contentType().toUpperCase());
        User owner = request.ownerId() != null
                ? userRepository.findById(request.ownerId()).orElse(null)
                : null;
        FlaggedContent created = moderationService.scanAndFlag(
                type, request.contentId(), request.contentPreview(), owner,
                request.detectionSource());
        if (created == null) {
            return new ApiResponse<>("No violations detected", null);
        }
        return new ApiResponse<>("Content flagged", toDto(created));
    }

    // ── Helpers ──────────────────────────────────────────────────

    private static void ensureModerator(User currentUser) {
        AdminUtils.ensureAdmin(currentUser, AdminSubRole.MODERATOR);
    }

    private static java.time.OffsetDateTime parseDate(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            java.time.ZoneId zone = java.time.ZoneId.systemDefault();
            java.time.LocalDate date = java.time.LocalDate.parse(value.trim());
            return endOfDay
                    ? date.atTime(java.time.LocalTime.MAX).atZone(zone).toOffsetDateTime()
                    : date.atStartOfDay().atZone(zone).toOffsetDateTime();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date '" + value + "'. Use yyyy-MM-dd.");
        }
    }

    private static ModerationItemDto toDto(FlaggedContent f) {
        return new ModerationItemDto(
                f.getId(),
                f.getContentType(), f.getContentId(), f.getContentPreview(),
                f.getOwner() != null ? f.getOwner().getId() : null,
                f.getOwner() != null ? f.getOwner().getFullName() : null,
                f.getOwner() != null ? f.getOwner().getEmail() : null,
                f.getOwner() != null ? f.getOwner().getDisplayUsername() : null,
                f.getOwner() != null ? f.getOwner().isEnabled() : null,
                f.getReporter() != null ? f.getReporter().getId() : null,
                f.getReporter() != null ? f.getReporter().getFullName() : null,
                f.getReporter() != null ? f.getReporter().getEmail() : null,
                f.getDetectionSource(), f.getReason(), f.getPriority(), f.getStatus(),
                f.getAiConfidence(),
                f.getAssignedModerator() != null ? f.getAssignedModerator().getId() : null,
                f.getAssignedModerator() != null ? f.getAssignedModerator().getFullName() : null,
                f.getInternalNotes(),
                f.getEscalationLevel(), f.getEscalationReason(), f.getEscalatedAt(),
                f.getCreatedAt(), f.getUpdatedAt());
    }

    public record AssignRequest(Long moderatorId) {}
    public record EscalateRequest(Integer level, String reason) {}
    public record NoteRequest(@NotBlank String note) {}
    public record UserEnabledRequest(boolean enabled) {}

    public record ScanRequest(
            @NotBlank String contentType,
            Long contentId,
            String contentPreview,
            Long ownerId,
            DetectionSource detectionSource) {}

    public record ModerationItemDto(
            Long id,
            ContentType contentType, Long contentId, String contentPreview,
            Long ownerId, String ownerName, String ownerEmail, String ownerUsername,
            Boolean ownerEnabled,
            Long reporterId, String reporterName, String reporterEmail,
            DetectionSource detectionSource, String reason,
            ReportPriority priority, ModerationStatus status,
            Double aiConfidence,
            Long assignedModeratorId, String assignedModeratorName,
            String internalNotes,
            Integer escalationLevel, String escalationReason, java.time.OffsetDateTime escalatedAt,
            java.time.OffsetDateTime createdAt, java.time.OffsetDateTime updatedAt) {}

    public record ModerationEventDto(
            Long id, String action, String actorName,
            String fromStatus, String toStatus, String note, java.time.OffsetDateTime createdAt) {}
}
