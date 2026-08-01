package com.skillswap.skill;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkillRequestRepository extends JpaRepository<SkillRequest, Long> {

    List<SkillRequest> findByStatusOrderByCreatedAtDesc(SkillRequestStatus status);

    List<SkillRequest> findByRequestedByIdOrderByCreatedAtDesc(Long requestedById);

    Optional<SkillRequest> findFirstByNameIgnoreCaseAndStatusOrderByCreatedAtDesc(
            String name, SkillRequestStatus status);
}
