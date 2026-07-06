package com.skillswap.user;

import com.skillswap.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
