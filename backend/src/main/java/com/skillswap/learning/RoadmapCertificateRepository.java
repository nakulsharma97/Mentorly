package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link RoadmapCertificate}.
 */
public interface RoadmapCertificateRepository extends JpaRepository<RoadmapCertificate, Long> {

    List<RoadmapCertificate> findByLearnerRoadmapIdOrderByIssuedAtDesc(Long learnerRoadmapId);

    boolean existsByLearnerRoadmapIdAndCode(Long learnerRoadmapId, String code);
}
