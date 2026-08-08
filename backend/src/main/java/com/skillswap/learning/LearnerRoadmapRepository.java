package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link LearnerRoadmap}.
 */
public interface LearnerRoadmapRepository extends JpaRepository<LearnerRoadmap, Long> {

    List<LearnerRoadmap> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    Optional<LearnerRoadmap> findFirstByLearnerIdAndStatusOrderByUpdatedAtDesc(
            Long learnerId, RoadmapStatus status);
}
