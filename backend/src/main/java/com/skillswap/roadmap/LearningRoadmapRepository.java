package com.skillswap.roadmap;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code LearningRoadmap} persistence.
 */
public interface LearningRoadmapRepository extends JpaRepository<LearningRoadmap, Long> {
    Optional<LearningRoadmap> findByBookingId(Long bookingId);

    List<LearningRoadmap> findByBookingLearnerId(Long learnerId);

    List<LearningRoadmap> findByBookingSessionMentorId(Long mentorId);
}
