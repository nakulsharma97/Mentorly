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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * REST controller for the learner "Daily Tasks" feature. Every read and write
 * is learner-scoped against the authenticated user — one learner can never
 * touch another's tasks.
 */
@RestController
@RequestMapping("/api/v1/learning/tasks")
@RequiredArgsConstructor
public class LearnerTaskController {

    private final LearnerTaskService taskService;

    /** Lists the learner's tasks, optionally filtered (ALL / TODAY / UPCOMING / COMPLETED / OVERDUE / PERSONAL / SESSION_TASKS). */
    @GetMapping
    public ApiResponse<List<LearnerTaskDtos.TaskDto>> list(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "ALL") String filter) {
        return new ApiResponse<>("Tasks fetched", taskService.listTasks(currentUser, filter));
    }

    /** Today's progress + consistency streak. */
    @GetMapping("/stats")
    public ApiResponse<LearnerTaskDtos.TaskStatsDto> stats(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Task stats fetched", taskService.stats(currentUser));
    }

    /** Generates deterministic follow-up tasks from real session activity. */
    @PostMapping("/generate")
    public ApiResponse<List<LearnerTaskDtos.TaskDto>> generate(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Follow-up tasks generated", taskService.generateFromSessions(currentUser));
    }

    @GetMapping("/{id}")
    public ApiResponse<LearnerTaskDtos.TaskDto> get(
            @AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return new ApiResponse<>("Task fetched", taskService.getTask(currentUser, id));
    }

    @PostMapping
    public ApiResponse<LearnerTaskDtos.TaskDto> create(
            @AuthenticationPrincipal User currentUser,
            @RequestBody LearnerTaskDtos.TaskCreateRequest request) {
        return new ApiResponse<>("Task created", taskService.createTask(currentUser, request));
    }

    @PutMapping("/{id}")
    public ApiResponse<LearnerTaskDtos.TaskDto> update(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody LearnerTaskDtos.TaskUpdateRequest request) {
        return new ApiResponse<>("Task updated", taskService.updateTask(currentUser, id, request));
    }

    @PatchMapping("/{id}/complete")
    public ApiResponse<LearnerTaskDtos.TaskDto> complete(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody CompleteTaskRequest request) {
        return new ApiResponse<>("Task updated",
                taskService.setCompleted(currentUser, id, Boolean.TRUE.equals(request.completed())));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> delete(@AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        taskService.deleteTask(currentUser, id);
        return new ApiResponse<>("Task deleted", true);
    }

    public record CompleteTaskRequest(Boolean completed) {
    }
}
