package com.mentorly.user;

import com.mentorly.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing user project endpoints.
 */
@RestController
@RequestMapping("/api/v1/users/me/projects")
@RequiredArgsConstructor
@Slf4j
public class UserProjectController {

    private final UserProjectService userProjectService;

    @GetMapping
    public ApiResponse<List<UserProjectDto>> listProjects(@AuthenticationPrincipal User user) {
        log.info("listProjects userId={}", user.getId());
        return new ApiResponse<>("Projects fetched", userProjectService.listProjects(user));
    }

    @PostMapping
    public ApiResponse<UserProjectDto> createProject(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UserProjectDto request) {
        log.info("createProject userId={} request={}", user.getId(), request);
        return new ApiResponse<>("Project created", userProjectService.createProject(user, request));
    }

    @PutMapping("/{projectId}")
    public ApiResponse<UserProjectDto> updateProject(
            @AuthenticationPrincipal User user,
            @PathVariable Long projectId,
            @Valid @RequestBody UserProjectDto request) {
        log.info("updateProject userId={} projectId={} request={}", user.getId(), projectId, request);
        return new ApiResponse<>("Project updated", userProjectService.updateProject(user, projectId, request));
    }

    @DeleteMapping("/{projectId}")
    public ApiResponse<String> deleteProject(
            @AuthenticationPrincipal User user,
            @PathVariable Long projectId) {
        userProjectService.deleteProject(user, projectId);
        return new ApiResponse<>("Project deleted", "ok");
    }
}
