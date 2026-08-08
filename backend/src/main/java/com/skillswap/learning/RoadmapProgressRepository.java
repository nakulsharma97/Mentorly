package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link RoadmapProgress}.
 */
public interface RoadmapProgressRepository extends JpaRepository<RoadmapProgress, Long> {

    List<RoadmapProgress> findByLearnerRoadmapId(Long learnerRoadmapId);

    Optional<RoadmapProgress> findByLearnerRoadmapIdAndLessonId(Long learnerRoadmapId, Long lessonId);

    void deleteByLearnerRoadmapIdAndLessonId(Long learnerRoadmapId, Long lessonId);

    long countByLearnerRoadmapId(Long learnerRoadmapId);
}
