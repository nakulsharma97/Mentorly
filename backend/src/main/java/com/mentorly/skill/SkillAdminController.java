package com.mentorly.skill;

import com.mentorly.common.AdminUtils;
import com.mentorly.common.ApiResponse;
import com.mentorly.common.AuditLog;
import com.mentorly.common.AuditLogRepository;
import com.mentorly.common.AuditLogService;
import com.mentorly.notification.NotificationService;
import com.mentorly.user.AdminSubRole;
import com.mentorly.user.User;
import com.mentorly.verification.SkillVerificationTaskRepository;
import com.mentorly.watchlist.SkillWatchlistRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Admin skill catalog management.
 *
 * <ul>
 *   <li>GET /skills — view every skill with usage counts (watchlists + verification tasks)</li>
 *   <li>PATCH /skills/{id} — edit a skill (renames also re-point dependent references)</li>
 *   <li>DELETE /skills/{id} — delete a spam skill (refused when verification tasks depend on it)</li>
 *   <li>POST /skills/{id}/merge — merge a duplicate skill into another, keeping references consistent</li>
 *   <li>GET /skill-requests — moderation queue for newly proposed skill categories</li>
 *   <li>PATCH /skill-requests/{id} — approve (creates the catalog entry) or reject a proposal</li>
 * </ul>
 *
 * All endpoints are admin-only (SecurityConfig {@code /api/v1/admin/**} + {@code ensureAdmin}).
 * Audit logs are written for every mutation so the moderation trail stays complete.
 */
@RestController
@RequestMapping("/api/v1/admin/skills")
@RequiredArgsConstructor
public class SkillAdminController {

    private static final Logger LOG = LoggerFactory.getLogger(SkillAdminController.class);

    private final SkillRepository skillRepository;
    private final SkillRequestRepository skillRequestRepository;
    private final SkillWatchlistRepository skillWatchlistRepository;
    private final SkillVerificationTaskRepository skillVerificationTaskRepository;
    private final NotificationService notificationService;
    private final AuditLogRepository auditLogRepository;

    // ════════════════════════════════════════════════
    //  View all skills
    // ════════════════════════════════════════════════

    @GetMapping
    public ApiResponse<List<SkillAdminDto>> listSkills(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String q) {
        ensureAdmin(currentUser);

        List<Skill> skills = skillRepository.findAllByOrderByNameAsc();
        if (q != null && !q.isBlank()) {
            String lower = q.toLowerCase(Locale.ROOT);
            skills = skills.stream()
                    .filter(s -> s.getName().toLowerCase(Locale.ROOT).contains(lower)
                            || (s.getCategory() != null && s.getCategory().toLowerCase(Locale.ROOT).contains(lower)))
                    .toList();
        }

        Map<String, Long> watcherCounts = groupedToMap(skillWatchlistRepository.countGroupedBySkillName());
        Map<String, Long> taskCounts = groupedToMap(skillVerificationTaskRepository.countGroupedBySkillName());

        List<SkillAdminDto> dtos = skills.stream()
                .map(s -> new SkillAdminDto(
                        s.getId(),
                        s.getName(),
                        s.getCategory(),
                        watcherCounts.getOrDefault(s.getName().toLowerCase(Locale.ROOT), 0L),
                        taskCounts.getOrDefault(s.getName().toLowerCase(Locale.ROOT), 0L)))
                .toList();

        return new ApiResponse<>("Skills fetched", dtos);
    }

    // ════════════════════════════════════════════════
    //  Edit a skill
    // ════════════════════════════════════════════════

    @PatchMapping("/{id}")
    @Transactional
    public ApiResponse<SkillAdminDto> editSkill(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody EditSkillRequest request) {
        ensureAdmin(currentUser);

        Skill skill = findSkill(id);
        String newName = request.name() == null ? null : request.name().trim();
        String newCategory = request.category() == null ? null : request.category().trim();
        if (newName == null || newName.isEmpty()) {
            throw new IllegalArgumentException("Skill name is required");
        }
        if (newCategory == null || newCategory.isEmpty()) {
            throw new IllegalArgumentException("Skill category is required");
        }

        // Name must stay unique (case-insensitive) across the catalog.
        skillRepository.findByNameIgnoreCase(newName)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("A skill named \"" + newName + "\" already exists");
                });

        String oldName = skill.getName();
        skill.setName(newName);
        skill.setCategory(newCategory);
        skillRepository.save(skill);

        // Keep dependent references pointing at the canonical name when renamed.
        if (!oldName.equalsIgnoreCase(newName)) {
            skillWatchlistRepository.mergeSkillName(oldName, newName);
            skillWatchlistRepository.deleteDuplicateMergedSkillName(oldName, newName);
            skillVerificationTaskRepository.mergeSkillName(oldName, newName);
        }

        saveAuditLog(currentUser, "EDIT_SKILL", "Skill", id,
                "Renamed \"" + oldName + "\" to \"" + newName + "\" (category: " + newCategory + ")");

        return new ApiResponse<>("Skill updated", new SkillAdminDto(
                skill.getId(), skill.getName(), skill.getCategory(),
                skillWatchlistRepository.countBySkillNameIgnoreCase(newName),
                skillVerificationTaskRepository.countBySkillNameIgnoreCase(newName)));
    }

    // ════════════════════════════════════════════════
    //  Delete a spam skill
    // ════════════════════════════════════════════════

    @DeleteMapping("/{id}")
    @Transactional
    public ApiResponse<Map<String, String>> deleteSkill(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);

        Skill skill = findSkill(id);

        // Refuse when mentor-created verification tasks depend on this skill so
        // we never orphan active content — those should be merged instead.
        long dependentTasks = skillVerificationTaskRepository.countBySkillNameIgnoreCase(skill.getName());
        if (dependentTasks > 0) {
            throw new IllegalArgumentException(
                    "Cannot delete \"" + skill.getName() + "\": " + dependentTasks
                            + " verification task(s) reference it. Merge the skill instead.");
        }

        // Remove learner watchlist references so no stale entries remain.
        skillWatchlistRepository.deleteBySkillNameIgnoreCase(skill.getName());
        skillRepository.delete(skill);

        saveAuditLog(currentUser, "DELETE_SKILL", "Skill", id,
                "Deleted spam skill \"" + skill.getName() + "\" (category: " + skill.getCategory() + ")");

        return new ApiResponse<>("Skill deleted", Map.of("deletedSkillId", String.valueOf(id)));
    }

    // ════════════════════════════════════════════════
    //  Merge duplicate skills
    // ════════════════════════════════════════════════

    @PostMapping("/{id}/merge")
    @Transactional
    public ApiResponse<SkillAdminDto> mergeSkill(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody MergeSkillRequest request) {
        ensureAdmin(currentUser);

        Skill source = findSkill(id);
        Skill target = skillRepository.findById(request.targetSkillId())
                .orElseThrow(() -> new IllegalArgumentException("Target skill not found"));

        if (source.getId().equals(target.getId())) {
            throw new IllegalArgumentException("Cannot merge a skill into itself");
        }
        if (source.getName().equalsIgnoreCase(target.getName())) {
            throw new IllegalArgumentException("The skills already share the same name");
        }

        String sourceName = source.getName();
        String targetName = target.getName();

        // Re-point learner watchlists to the canonical skill, dropping rows that
        // already track the target for the same learner (unique constraint).
        skillWatchlistRepository.mergeSkillName(sourceName, targetName);
        skillWatchlistRepository.deleteDuplicateMergedSkillName(sourceName, targetName);

        // Re-point mentor verification tasks to the canonical skill.
        skillVerificationTaskRepository.mergeSkillName(sourceName, targetName);

        skillRepository.delete(source);

        saveAuditLog(currentUser, "MERGE_SKILL", "Skill", source.getId(),
                "Merged \"" + sourceName + "\" (id=" + source.getId() + ") into \"" + targetName
                        + "\" (id=" + target.getId() + ")");

        return new ApiResponse<>("Skills merged", new SkillAdminDto(
                target.getId(), target.getName(), target.getCategory(),
                skillWatchlistRepository.countBySkillNameIgnoreCase(targetName),
                skillVerificationTaskRepository.countBySkillNameIgnoreCase(targetName)));
    }

    // ════════════════════════════════════════════════
    //  Skill category requests (approve new categories)
    // ════════════════════════════════════════════════

    @GetMapping("/skill-requests")
    public ApiResponse<List<SkillRequestDto>> listSkillRequests(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") SkillRequestStatus status) {
        ensureAdmin(currentUser);
        List<SkillRequestDto> dtos = skillRequestRepository.findByStatusOrderByCreatedAtDesc(status)
                .stream().map(this::toDto).toList();
        return new ApiResponse<>("Skill requests fetched", dtos);
    }

    @PatchMapping("/skill-requests/{id}")
    @Transactional
    public ApiResponse<SkillRequestDto> decideSkillRequest(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody SkillRequestDecisionRequest request) {
        ensureAdmin(currentUser);

        SkillRequest skillRequest = skillRequestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Skill request not found"));
        if (skillRequest.getStatus() != SkillRequestStatus.PENDING) {
            throw new IllegalArgumentException("Skill request is already " + skillRequest.getStatus().name());
        }
        if (request.status() == null || request.status() == SkillRequestStatus.PENDING) {
            throw new IllegalArgumentException("A decision (APPROVED or REJECTED) is required");
        }

        User requester = skillRequest.getRequestedBy();
        String name = skillRequest.getName();

        // Persist the decision first so a failed save can never leave the
        // requester notified about a decision that was never recorded.
        skillRequest.setStatus(request.status());
        skillRequest.setAdminNote(trimToNull(request.adminNote()));
        skillRequest.setUpdatedAt(OffsetDateTime.now());
        SkillRequest saved = skillRequestRepository.save(skillRequest);

        if (request.status() == SkillRequestStatus.APPROVED) {
            // Create the catalog entry if it does not already exist (a second
            // request may have raced in, or the skill was created meanwhile).
            if (!skillRepository.existsByNameIgnoreCase(name)) {
                Skill skill = new Skill();
                skill.setName(name);
                skill.setCategory(skillRequest.getCategory());
                skillRepository.save(skill);
            }
            saveAuditLog(currentUser, "APPROVE_SKILL_REQUEST", "SkillRequest", id,
                    "Approved skill category \"" + name + "\" (category: " + skillRequest.getCategory() + ")");
            notifyRequester(requester, "SKILL_REQUEST",
                    "Skill category approved",
                    "Your suggested skill \"" + name + "\" was approved and added to the catalog.");
        } else {
            saveAuditLog(currentUser, "REJECT_SKILL_REQUEST", "SkillRequest", id,
                    "Rejected skill category \"" + name + "\""
                            + (request.adminNote() == null ? "" : " — " + request.adminNote()));
            notifyRequester(requester, "SKILL_REQUEST",
                    "Skill category rejected",
                    "Your suggested skill \"" + name + "\" was not approved."
                            + (request.adminNote() == null ? "" : " Reason: " + request.adminNote()));
        }

        return new ApiResponse<>("Skill request updated", toDto(saved));
    }

    // ════════════════════════════════════════════════
    //  Helpers
    // ════════════════════════════════════════════════

    private Skill findSkill(Long id) {
        return skillRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found"));
    }

    private static Map<String, Long> groupedToMap(List<Object[]> rows) {
        Map<String, Long> result = new HashMap<>();
        for (Object[] row : rows) {
            String key = row[0] == null ? "" : String.valueOf(row[0]);
            long count = row[1] == null ? 0L : ((Number) row[1]).longValue();
            result.put(key, result.getOrDefault(key, 0L) + count);
        }
        return result;
    }

    private SkillRequestDto toDto(SkillRequest request) {
        return new SkillRequestDto(
                request.getId(),
                request.getName(),
                request.getCategory(),
                request.getStatus().name(),
                request.getRequestedBy() == null ? null : request.getRequestedBy().getId(),
                request.getRequestedBy() == null ? null : request.getRequestedBy().getFullName(),
                request.getAdminNote(),
                request.getCreatedAt(),
                request.getUpdatedAt());
    }

    private void notifyRequester(User requester, String type, String title, String message) {
        if (requester == null || requester.getId() == null) {
            return;
        }
        try {
            notificationService.notifyUser(requester.getId(), type, title, message, null);
        } catch (Exception ex) {
            LOG.warn("Failed to notify requester {} about skill request", requester.getId(), ex);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void saveAuditLog(User admin, String action, String entityType, Long entityId, String details) {
        try {
            AuditLog log = new AuditLog();
            log.setAdminId(admin.getId());
            log.setAdminEmail(admin.getEmail());
            log.setAction(action);
            log.setEntityType(entityType);
            log.setEntityId(entityId);
            log.setDetails(details);
            log.setIpAddress(AuditLogService.extractClientIp());
            auditLogRepository.save(log);
        } catch (Exception ignored) {
            LOG.warn("Failed to save audit log", ignored);
        }
    }

    private static void ensureAdmin(User currentUser, AdminSubRole... requiredSubRole) {
        AdminUtils.ensureAdmin(currentUser, requiredSubRole);
    }

    // ════════════════════════════════════════════════
    //  DTOs
    // ════════════════════════════════════════════════

/**
 * Immutable data carrier for skill admin.
 */
    public record SkillAdminDto(Long id, String name, String category,
            long watchers, long verificationTasks) { }

/**
 * Immutable data carrier for edit skill request.
 */
    public record EditSkillRequest(@NotBlank String name, @NotBlank String category) { }

/**
 * Immutable data carrier for merge skill request.
 */
    public record MergeSkillRequest(@NotNull Long targetSkillId) { }

/**
 * Immutable data carrier for skill request decision request.
 */
    public record SkillRequestDecisionRequest(SkillRequestStatus status, String adminNote) { }
}
