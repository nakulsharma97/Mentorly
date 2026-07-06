package com.skillswap.watchlist;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/watchlist")
@RequiredArgsConstructor
public class WatchlistController {

    private final SavedMentorRepository savedMentorRepository;
    private final SkillWatchlistRepository skillWatchlistRepository;
    private final UserRepository userRepository;

    @GetMapping("/mentors")
    public ApiResponse<List<SavedMentor>> listSavedMentors(@AuthenticationPrincipal User learner) {
        return new ApiResponse<>("Saved mentors fetched", savedMentorRepository.findByLearnerId(learner.getId()));
    }

    @PostMapping("/mentors/{mentorId}")
    public ApiResponse<SavedMentor> saveMentor(@AuthenticationPrincipal User learner, @PathVariable Long mentorId) {
        if (learner.getId().equals(mentorId)) {
            throw new IllegalArgumentException("You cannot save yourself as mentor");
        }

        savedMentorRepository.findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Mentor already saved");
                });

        User mentor = userRepository.findById(mentorId)
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));
        if (!"MENTOR".equals(mentor.getRole().name())) {
            throw new IllegalArgumentException("Selected user is not a mentor");
        }

        SavedMentor savedMentor = new SavedMentor();
        savedMentor.setLearner(learner);
        savedMentor.setMentor(mentor);
        return new ApiResponse<>("Mentor saved", savedMentorRepository.save(savedMentor));
    }

    @DeleteMapping("/mentors/{mentorId}")
    public ApiResponse<Boolean> removeMentor(@AuthenticationPrincipal User learner, @PathVariable Long mentorId) {
        SavedMentor savedMentor = savedMentorRepository.findByLearnerIdAndMentorId(learner.getId(), mentorId)
                .orElseThrow(() -> new IllegalArgumentException("Saved mentor not found"));
        savedMentorRepository.delete(savedMentor);
        return new ApiResponse<>("Saved mentor removed", true);
    }

    @GetMapping("/skills")
    public ApiResponse<List<SkillWatchlist>> listSkills(@AuthenticationPrincipal User learner) {
        return new ApiResponse<>("Skill watchlist fetched", skillWatchlistRepository.findByLearnerId(learner.getId()));
    }

    @PostMapping("/skills")
    public ApiResponse<SkillWatchlist> saveSkill(@AuthenticationPrincipal User learner,
            @RequestBody SkillWatchRequest req) {
        String normalized = req.skillName() == null ? "" : req.skillName().trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("skillName is required");
        }

        skillWatchlistRepository.findByLearnerIdAndSkillNameIgnoreCase(learner.getId(), normalized)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Skill already in watchlist");
                });

        SkillWatchlist skillWatchlist = new SkillWatchlist();
        skillWatchlist.setLearner(learner);
        skillWatchlist.setSkillName(normalized);
        return new ApiResponse<>("Skill added to watchlist", skillWatchlistRepository.save(skillWatchlist));
    }

    @DeleteMapping("/skills/{skillName}")
    public ApiResponse<Boolean> removeSkill(@AuthenticationPrincipal User learner, @PathVariable String skillName) {
        SkillWatchlist item = skillWatchlistRepository.findByLearnerIdAndSkillNameIgnoreCase(learner.getId(), skillName)
                .orElseThrow(() -> new IllegalArgumentException("Skill not found in watchlist"));
        skillWatchlistRepository.delete(item);
        return new ApiResponse<>("Skill removed from watchlist", true);
    }

    public record SkillWatchRequest(String skillName) {
    }
}
