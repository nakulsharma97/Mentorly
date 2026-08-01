package com.skillswap.skill;

import com.skillswap.common.AdminUtils;
import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Skill catalog + skill request endpoints.
 *
 * <ul>
 *   <li>GET / — public list of skills</li>
 *   <li>POST / — direct create; admin-only (regular users submit a request instead)</li>
 *   <li>POST /request — any authenticated user proposes a new skill category for approval</li>
 *   <li>GET /my-requests — the authenticated user's request history</li>
 * </ul>
 *
 * Approval of proposed categories happens in {@link SkillAdminController}.
 */
@RestController
@RequestMapping("/api/v1/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillRepository skillRepository;
    private final SkillRequestRepository skillRequestRepository;

    @GetMapping
    public ApiResponse<List<Skill>> getAll() {
        return new ApiResponse<>("Skills fetched", skillRepository.findAllByOrderByNameAsc());
    }

    @PostMapping
    public ApiResponse<Skill> create(@AuthenticationPrincipal User currentUser, @RequestBody Skill skill) {
        AdminUtils.ensureAdmin(currentUser);
        if (skill == null || skill.getName() == null || skill.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Skill name is required");
        }
        if (skill.getCategory() == null || skill.getCategory().trim().isEmpty()) {
            throw new IllegalArgumentException("Skill category is required");
        }
        String name = skill.getName().trim();
        if (skillRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A skill named \"" + name + "\" already exists");
        }
        skill.setName(name);
        skill.setCategory(skill.getCategory().trim());
        return new ApiResponse<>("Skill created", skillRepository.save(skill));
    }

    @PostMapping("/request")
    public ApiResponse<SkillRequestDto> submitRequest(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody SubmitSkillRequest request) {
        String name = request.name() == null ? null : request.name().trim();
        String category = request.category() == null ? null : request.category().trim();
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Skill name is required");
        }
        if (category == null || category.isEmpty()) {
            throw new IllegalArgumentException("Skill category is required");
        }
        if (skillRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("A skill named \"" + name + "\" already exists");
        }
        if (skillRequestRepository
                .findFirstByNameIgnoreCaseAndStatusOrderByCreatedAtDesc(name, SkillRequestStatus.PENDING)
                .isPresent()) {
            throw new IllegalArgumentException("A pending request for \"" + name + "\" already exists");
        }

        SkillRequest skillRequest = new SkillRequest();
        skillRequest.setName(name);
        skillRequest.setCategory(category);
        skillRequest.setRequestedBy(currentUser);
        skillRequest.setStatus(SkillRequestStatus.PENDING);
        skillRequest.setCreatedAt(OffsetDateTime.now());
        SkillRequest saved = skillRequestRepository.save(skillRequest);

        return new ApiResponse<>("Skill request submitted for approval", toDto(saved));
    }

    @GetMapping("/my-requests")
    public ApiResponse<List<SkillRequestDto>> myRequests(@AuthenticationPrincipal User currentUser) {
        List<SkillRequestDto> dtos = skillRequestRepository
                .findByRequestedByIdOrderByCreatedAtDesc(currentUser.getId())
                .stream().map(this::toDto).toList();
        return new ApiResponse<>("Skill requests fetched", dtos);
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

    public record SubmitSkillRequest(@NotBlank String name, @NotBlank String category) {}
}
