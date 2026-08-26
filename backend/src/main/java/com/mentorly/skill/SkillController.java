package com.mentorly.skill;

import com.mentorly.common.AdminUtils;
import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
/**
 * REST controller exposing skill endpoints.
 */
@RestController
@RequestMapping("/api/v1/skills")
@RequiredArgsConstructor
@Slf4j
public class SkillController {

    private final SkillRepository skillRepository;
    private final SkillRequestRepository skillRequestRepository;

    /**
     * Public skill catalog. Cached for 1 hour — skills change rarely
     * (only via admin approval). Cache key: literal 'all'.
     */
    @GetMapping
    @Cacheable(value = "skills", key = "'all'")
    public ApiResponse<List<Skill>> getAll() {
        log.debug("CACHE MISS: fetching skills from database");
        return new ApiResponse<>("Skills fetched", skillRepository.findAllByOrderByNameAsc());
    }

    @PostMapping
    @CacheEvict(value = "skills", key = "'all'")
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
    public ApiResponse<Page<SkillRequestDto>> myRequests(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<SkillRequestDto> dtos = skillRequestRepository
                .findByRequestedByIdOrderByCreatedAtDesc(currentUser.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(this::toDto);
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

/**
 * Immutable data carrier for submit skill request.
 */
    public record SubmitSkillRequest(@NotBlank String name, @NotBlank String category) { }
}
