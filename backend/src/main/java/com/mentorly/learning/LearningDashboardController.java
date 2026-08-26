package com.mentorly.learning;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
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

import java.util.List;

/**
 * REST controller for the session-based "My Learning" dashboard. Every read and
 * write is learner-scoped against the authenticated user.
 */
@RestController
@RequestMapping("/api/v1/learning")
@RequiredArgsConstructor
public class LearningDashboardController {

    private final LearningDashboardService dashboardService;

    /** Aggregated session-based dashboard (hero, stats, timeline, mentors, calendar, todos, activity). */
    @GetMapping("/dashboard")
    public ApiResponse<LearningDashboardDtos.DashboardDto> dashboard(
            @AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Dashboard fetched", dashboardService.getDashboard(currentUser));
    }

    /** Paginated, searchable + filterable session history table. */
    @GetMapping("/history")
    public ApiResponse<LearningDashboardDtos.HistoryPageDto> history(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return new ApiResponse<>("Learning history fetched",
                dashboardService.getHistory(currentUser, search, status, page, size));
    }

    /* ── Todos ── */

    @GetMapping("/todos")
    public ApiResponse<List<LearningDashboardDtos.TodoDto>> todos(
            @AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Todos fetched", dashboardService.listTodos(currentUser));
    }

    @PostMapping("/todos")
    public ApiResponse<LearningDashboardDtos.TodoDto> createTodo(
            @AuthenticationPrincipal User currentUser,
            @RequestBody TodoRequest request) {
        return new ApiResponse<>("Todo added",
                dashboardService.createTodo(currentUser, request.task(), request.done()));
    }

    @PatchMapping("/todos/{id}")
    public ApiResponse<LearningDashboardDtos.TodoDto> updateTodo(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody TodoUpdateRequest request) {
        return new ApiResponse<>("Todo updated",
                dashboardService.updateTodo(currentUser, id, request.task(), request.done()));
    }

    @DeleteMapping("/todos/{id}")
    public ApiResponse<Boolean> deleteTodo(@AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        dashboardService.deleteTodo(currentUser, id);
        return new ApiResponse<>("Todo deleted", true);
    }

    /* ── Session notes ── */

    @GetMapping("/sessions/{bookingId}/notes")
    public ApiResponse<LearningDashboardDtos.SessionNoteDto> getNote(
            @AuthenticationPrincipal User currentUser, @PathVariable Long bookingId) {
        return new ApiResponse<>("Note fetched", dashboardService.getNote(currentUser, bookingId));
    }

    @PutMapping("/sessions/{bookingId}/notes")
    public ApiResponse<LearningDashboardDtos.SessionNoteDto> saveNote(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long bookingId,
            @RequestBody NoteRequest request) {
        return new ApiResponse<>("Note saved",
                dashboardService.saveNote(currentUser, bookingId, request.content()));
    }

    public record TodoRequest(String task, Boolean done) {
    }

    public record TodoUpdateRequest(String task, Boolean done) {
    }

    public record NoteRequest(String content) {
    }
}
