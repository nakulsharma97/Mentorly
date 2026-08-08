package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link RoadmapModule}.
 */
public interface RoadmapModuleRepository extends JpaRepository<RoadmapModule, Long> {

    List<RoadmapModule> findByCareerPathIdOrderByOrderIndexAsc(Long careerPathId);
}
