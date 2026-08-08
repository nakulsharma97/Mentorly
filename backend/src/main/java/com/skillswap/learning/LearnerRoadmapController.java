package com.skillswap.learning;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for the learner-facing "My Learning" roadmap management.
 *
 * <p>Endpoints are learner-scoped: every read/write is checked against the
 * authenticated user, so one learner can never touch another's roadmap.
 */
@RestController
@RequestMapping("/api/v1/learning/roadmaps")
@RequiredArgsConstructor
public class LearnerRoadmapController {

    private final LearningRoadmapService learningRoadmapService;

    /** Lists every roadmap owned by the authenticated learner. */
    @GetMapping
    public ApiResponse<List<LearningDtos.LearnerRoadmapSummaryDto>> list(
            @AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Roadmaps fetched", learningRoadmapService.listRoadmaps(currentUser));
    }

    /** Returns the ACTIVE roadmap with full detail, or {@code null} if none exists. */
    @GetMapping("/active")
    public ApiResponse<LearningDtos.LearnerRoadmapDetailDto> active(
            @AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Active roadmap fetched",
                learningRoadmapService.getActiveRoadmap(currentUser));
    }

    /** Returns one roadmap with full detail (owner-only). */
    @GetMapping("/{id}")
    public ApiResponse<LearningDtos.LearnerRoadmapDetailDto> get(
            @AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return new ApiResponse<>("Roadmap fetched", learningRoadmapService.getRoadmap(currentUser, id));
    }

    /**
     * Creates a new ACTIVE roadmap for the chosen career path. Any existing
     * ACTIVE roadmap is archived (progress preserved) so only one stays active.
     */
    @PostMapping
    public ApiResponse<LearningDtos.LearnerRoadmapDetailDto> create(
            @AuthenticationPrincipal User currentUser,
            @RequestBody CreateRoadmapRequest request) {
        if (request.careerPathId() == null) {
            throw new IllegalArgumentException("careerPathId is required");
        }
        return new ApiResponse<>("Roadmap created",
                learningRoadmapService.createRoadmap(currentUser, request.careerPathId()));
    }

    /** Marks a lesson complete/incomplete and recomputes roadmap progress. */
    @PatchMapping("/{id}/progress")
    public ApiResponse<LearningDtos.LearnerRoadmapDetailDto> updateProgress(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateProgressRequest request) {
        if (request.lessonId() == null) {
            throw new IllegalArgumentException("lessonId is required");
        }
        return new ApiResponse<>("Progress updated",
                learningRoadmapService.toggleLesson(currentUser, id, request.lessonId(),
                        Boolean.TRUE.equals(request.completed())));
    }

    /** Switches or archives a roadmap ({@code action}: "switch" | "archive"). */
    @PatchMapping("/{id}/status")
    public ApiResponse<LearningDtos.LearnerRoadmapSummaryDto> updateStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateStatusRequest request) {
        if (request.action() == null || request.action().isBlank()) {
            throw new IllegalArgumentException("action is required");
        }
        return new ApiResponse<>("Roadmap updated",
                learningRoadmapService.updateStatus(currentUser, id, request.action()));
    }

    /** Deletes a roadmap that has never been started. */
    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        learningRoadmapService.deleteRoadmap(currentUser, id);
        return new ApiResponse<>("Roadmap deleted", true);
    }

    public record CreateRoadmapRequest(Long careerPathId) {
    }

    public record UpdateProgressRequest(Long lessonId, Boolean completed) {
    }

    public record UpdateStatusRequest(String action) {
    }
}
