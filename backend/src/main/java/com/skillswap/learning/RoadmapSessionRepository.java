package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link RoadmapSession}.
 */
public interface RoadmapSessionRepository extends JpaRepository<RoadmapSession, Long> {

    List<RoadmapSession> findByCareerPathIdOrderByOrderIndexAsc(Long careerPathId);
}
