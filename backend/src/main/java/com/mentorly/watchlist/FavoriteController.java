package com.mentorly.watchlist;

import com.mentorly.common.ApiResponse;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing the favorite-mentor API. Every endpoint is scoped to
 * the authenticated learner — a user can only ever read or modify their own
 * favorites (ownership is enforced by {@link FavoriteMentorService}).
 */
@RestController
@RequestMapping("/api/v1/favorites")
@RequiredArgsConstructor
public final class FavoriteController {

    private final FavoriteMentorService favoriteMentorService;
    private final ProfileCompletionGuard profileCompletionGuard;

    /** Returns all mentors favorited by the authenticated learner. */
    @GetMapping
    public ApiResponse<List<SavedMentorDto>> listFavorites(
            @AuthenticationPrincipal User learner) {
        return new ApiResponse<>("Favorites fetched",
                favoriteMentorService.listFavorites(learner));
    }

    /** Returns whether the authenticated learner has favorited the given mentor. */
    @GetMapping("/check/{mentorId}")
    public ApiResponse<Boolean> checkFavorite(
            @AuthenticationPrincipal User learner,
            @PathVariable Long mentorId) {
        return new ApiResponse<>("Favorite check",
                favoriteMentorService.isFavorite(learner, mentorId));
    }

    /** Adds a mentor to the authenticated learner's favorites. */
    @PostMapping("/{mentorId}")
    public ApiResponse<SavedMentorDto> addFavorite(
            @AuthenticationPrincipal User learner,
            @PathVariable Long mentorId) {
        profileCompletionGuard.requireProfileCompleted(learner,
                "Please complete your profile before saving mentors.");
        return new ApiResponse<>("Mentor added to favorites",
                favoriteMentorService.addFavorite(learner, mentorId));
    }

    /** Removes a mentor from the authenticated learner's favorites. */
    @DeleteMapping("/{mentorId}")
    public ApiResponse<Boolean> removeFavorite(
            @AuthenticationPrincipal User learner,
            @PathVariable Long mentorId) {
        return new ApiResponse<>("Mentor removed from favorites",
                favoriteMentorService.removeFavorite(learner, mentorId));
    }
}
