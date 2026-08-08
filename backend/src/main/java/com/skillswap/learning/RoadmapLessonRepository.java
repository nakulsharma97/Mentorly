package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link RoadmapLesson}.
 */
public interface RoadmapLessonRepository extends JpaRepository<RoadmapLesson, Long> {

    List<RoadmapLesson> findByModuleIdOrderByOrderIndexAsc(Long moduleId);

    List<RoadmapLesson> findByModuleCareerPathIdOrderByOrderIndexAsc(Long careerPathId);
}
