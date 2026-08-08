package com.skillswap.learning;

import com.skillswap.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing the database-driven career path catalog. Learners
 * pick a path here — nothing is ever generated for them.
 */
@RestController
@RequestMapping("/api/v1/career-paths")
@RequiredArgsConstructor
public class CareerPathController {

    private final LearningRoadmapService learningRoadmapService;

    @GetMapping
    public ApiResponse<List<LearningDtos.CareerPathSummaryDto>> listCareerPaths() {
        return new ApiResponse<>("Career paths fetched", learningRoadmapService.listCareerPaths());
    }

    @GetMapping("/{id}")
    public ApiResponse<LearningDtos.CareerPathDetailDto> getCareerPath(@PathVariable Long id) {
        return new ApiResponse<>("Career path fetched", learningRoadmapService.getCareerPathDetail(id));
    }
}
