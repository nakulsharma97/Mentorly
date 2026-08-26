package com.mentorly.watchlist;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for managing user watchlists (saved mentors and tracked skills).
 *
 * <p>The mentor-bookmark endpoints are kept as backward-compatible aliases for
 * the canonical favorite-mentor API exposed under {@code /api/v1/favorites}.
 * All logic delegates to {@link FavoriteMentorService}, which returns rich DTOs
 * instead of raw entities — this fixes the previous 500 caused by serializing
 * the {@code SavedMentor -> User -> UserProject} entity graph (infinite
 * Jackson recursion).
 */
@RestController
@RequestMapping("/api/v1/watchlist")
@RequiredArgsConstructor
public final class WatchlistController {

    private final FavoriteMentorService favoriteMentorService;
    private final SkillWatchlistRepository skillWatchlistRepository;

    /** Returns all mentors saved by the authenticated learner. */
    @GetMapping("/mentors")
    public ApiResponse<List<SavedMentorDto>> listSavedMentors(
            @AuthenticationPrincipal final User learner) {
        return new ApiResponse<>("Saved mentors fetched",
                favoriteMentorService.listFavorites(learner));
    }

    /** Adds a mentor to the authenticated learner's saved list. */
    @PostMapping("/mentors/{mentorId}")
    public ApiResponse<SavedMentorDto> saveMentor(@AuthenticationPrincipal final User learner,
            @PathVariable final Long mentorId) {
        return new ApiResponse<>("Mentor saved",
                favoriteMentorService.addFavorite(learner, mentorId));
    }

    /** Removes a mentor from the authenticated learner's saved list. */
    @DeleteMapping("/mentors/{mentorId}")
    public ApiResponse<Boolean> removeMentor(@AuthenticationPrincipal final User learner,
            @PathVariable final Long mentorId) {
        return new ApiResponse<>("Saved mentor removed",
                favoriteMentorService.removeFavorite(learner, mentorId));
    }

    /** Returns all skills tracked by the authenticated learner. */
    @GetMapping("/skills")
    public ApiResponse<Page<SkillWatchlist>> listSkills(
            @AuthenticationPrincipal final User learner,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return new ApiResponse<>("Skill watchlist fetched",
                skillWatchlistRepository.findByLearnerId(learner.getId(), PageRequest.of(page, Math.min(size, 50))));
    }

    /** Adds a skill to the authenticated learner's watchlist. */
    @PostMapping("/skills")
    public ApiResponse<SkillWatchlist> saveSkill(@AuthenticationPrincipal final User learner,
            @RequestBody final SkillWatchRequest req) {
        final String normalized = req.skillName() == null ? "" : req.skillName().trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("skillName is required");
        }
        skillWatchlistRepository
                .findByLearnerIdAndSkillNameIgnoreCase(learner.getId(), normalized)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Skill already in watchlist");
                });
        final SkillWatchlist skillWatchlist = new SkillWatchlist();
        skillWatchlist.setLearner(learner);
        skillWatchlist.setSkillName(normalized);
        return new ApiResponse<>("Skill added to watchlist",
                skillWatchlistRepository.save(skillWatchlist));
    }

    /** Removes a skill from the authenticated learner's watchlist. */
    @DeleteMapping("/skills/{skillName}")
    public ApiResponse<Boolean> removeSkill(@AuthenticationPrincipal final User learner,
            @PathVariable final String skillName) {
        final SkillWatchlist item = skillWatchlistRepository
                .findByLearnerIdAndSkillNameIgnoreCase(learner.getId(), skillName)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found in watchlist"));
        skillWatchlistRepository.delete(item);
        return new ApiResponse<>("Skill removed from watchlist", true);
    }

/**
 * Immutable data carrier for skill watch request.
 */
    public record SkillWatchRequest(String skillName) {
    }
}
