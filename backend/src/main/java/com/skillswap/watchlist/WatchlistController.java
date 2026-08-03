package com.skillswap.watchlist;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for managing user watchlists (saved mentors and tracked skills).
 */
@RestController
@RequestMapping("/api/v1/watchlist")
@RequiredArgsConstructor
public final class WatchlistController {

    private final SavedMentorRepository savedMentorRepository;
    private final SkillWatchlistRepository skillWatchlistRepository;
    private final UserRepository userRepository;

    /** Returns all mentors saved by the authenticated learner. */
    @GetMapping("/mentors")
    public ApiResponse<List<SavedMentor>> listSavedMentors(@AuthenticationPrincipal final User learner) {
        return new ApiResponse<>("Saved mentors fetched",
                savedMentorRepository.findByLearnerId(learner.getId()));
    }

    /** Adds a mentor to the authenticated learner's saved list. */
    @PostMapping("/mentors/{mentorId}")
    public ApiResponse<SavedMentor> saveMentor(@AuthenticationPrincipal final User learner,
            @PathVariable final Long mentorId) {
        if (learner.getId().equals(mentorId)) {
            throw new IllegalArgumentException("You cannot save yourself as mentor");
        }
        savedMentorRepository.findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Mentor already saved");
                });
        final User mentor = userRepository.findById(mentorId)
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));
        if (!"MENTOR".equals(mentor.getRole().name())) {
            throw new IllegalArgumentException("Selected user is not a mentor");
        }
        final SavedMentor savedMentor = new SavedMentor();
        savedMentor.setLearner(learner);
        savedMentor.setMentor(mentor);
        return new ApiResponse<>("Mentor saved",
                savedMentorRepository.save(savedMentor));
    }

    /** Removes a mentor from the authenticated learner's saved list. */
    @DeleteMapping("/mentors/{mentorId}")
    public ApiResponse<Boolean> removeMentor(@AuthenticationPrincipal final User learner,
            @PathVariable final Long mentorId) {
        final SavedMentor savedMentor = savedMentorRepository
                .findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .orElseThrow(() -> new IllegalArgumentException("Saved mentor not found"));
        savedMentorRepository.delete(savedMentor);
        return new ApiResponse<>("Saved mentor removed", true);
    }

    /** Returns all skills tracked by the authenticated learner. */
    @GetMapping("/skills")
    public ApiResponse<List<SkillWatchlist>> listSkills(@AuthenticationPrincipal final User learner) {
        return new ApiResponse<>("Skill watchlist fetched",
                skillWatchlistRepository.findByLearnerId(learner.getId()));
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

