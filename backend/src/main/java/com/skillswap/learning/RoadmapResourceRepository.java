package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link RoadmapResource}.
 */
public interface RoadmapResourceRepository extends JpaRepository<RoadmapResource, Long> {

    List<RoadmapResource> findByCareerPathIdOrderByOrderIndexAsc(Long careerPathId);
}
