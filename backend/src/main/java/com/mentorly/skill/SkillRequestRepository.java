package com.mentorly.skill;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code SkillRequest} persistence.
 */
public interface SkillRequestRepository extends JpaRepository<SkillRequest, Long> {

    List<SkillRequest> findByStatusOrderByCreatedAtDesc(SkillRequestStatus status);

    List<SkillRequest> findByRequestedByIdOrderByCreatedAtDesc(Long requestedById);

    Page<SkillRequest> findByRequestedByIdOrderByCreatedAtDesc(Long requestedById, Pageable pageable);

    Optional<SkillRequest> findFirstByNameIgnoreCaseAndStatusOrderByCreatedAtDesc(
            String name, SkillRequestStatus status);
}
