package com.skillswap.roadmap;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/roadmaps")
@RequiredArgsConstructor
public class LearningRoadmapController {

    private final LearningRoadmapRepository learningRoadmapRepository;

    @GetMapping
    public ApiResponse<List<LearningRoadmap>> list(@AuthenticationPrincipal User currentUser) {
        List<LearningRoadmap> roadmaps = currentUser.getRole().name().equals("MENTOR")
                ? learningRoadmapRepository.findByBookingSessionMentorId(currentUser.getId())
                : learningRoadmapRepository.findByBookingLearnerId(currentUser.getId());
        return new ApiResponse<>("Roadmaps fetched", roadmaps);
    }

    @GetMapping("/booking/{bookingId}")
    public ApiResponse<LearningRoadmap> getByBooking(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long bookingId) {
        LearningRoadmap roadmap = learningRoadmapRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Roadmap not found for booking"));

        boolean isLearner = roadmap.getBooking().getLearner().getId().equals(currentUser.getId());
        boolean isMentor = roadmap.getBooking().getSession().getMentor().getId().equals(currentUser.getId());
        if (!isLearner && !isMentor) {
            throw new IllegalArgumentException("Not allowed to access this roadmap");
        }

        return new ApiResponse<>("Roadmap fetched", roadmap);
    }

    @PatchMapping("/{id}")
    public ApiResponse<LearningRoadmap> updateRoadmap(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateRoadmapRequest req) {
        LearningRoadmap roadmap = learningRoadmapRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Roadmap not found"));

        boolean isLearner = roadmap.getBooking().getLearner().getId().equals(currentUser.getId());
        boolean isMentor = roadmap.getBooking().getSession().getMentor().getId().equals(currentUser.getId());
        if (!isLearner && !isMentor) {
            throw new IllegalArgumentException("Not allowed to update this roadmap");
        }

        if (req.milestones() != null) {
            roadmap.setMilestones(req.milestones().trim());
        }
        if (req.progressPercent() != null) {
            int progress = Math.max(0, Math.min(100, req.progressPercent()));
            roadmap.setProgressPercent(progress);
        }
        roadmap.setUpdatedAt(OffsetDateTime.now());

        return new ApiResponse<>("Roadmap updated", learningRoadmapRepository.save(roadmap));
    }

    public record UpdateRoadmapRequest(String milestones, Integer progressPercent) {
    }
}
