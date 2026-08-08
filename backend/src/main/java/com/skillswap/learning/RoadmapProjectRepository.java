package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link RoadmapProject}.
 */
public interface RoadmapProjectRepository extends JpaRepository<RoadmapProject, Long> {

    List<RoadmapProject> findByCareerPathIdOrderByOrderIndexAsc(Long careerPathId);
}
