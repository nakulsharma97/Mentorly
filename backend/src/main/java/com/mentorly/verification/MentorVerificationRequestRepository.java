package com.mentorly.verification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code MentorVerificationRequest} persistence.
 */
public interface MentorVerificationRequestRepository extends JpaRepository<MentorVerificationRequest, Long> {
    List<MentorVerificationRequest> findByMentorIdOrderByCreatedAtDesc(Long mentorId);

    List<MentorVerificationRequest> findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus status);

    Optional<MentorVerificationRequest> findFirstByMentorIdAndStatusOrderByCreatedAtDesc(
            Long mentorId, MentorVerificationRequestStatus status);

    /**
     * Latest request (by creation) for a mentor regardless of status — feeds
     * the mentor dashboard status banner and duplicate-application checks.
     */
    Optional<MentorVerificationRequest> findFirstByMentorIdOrderByCreatedAtDesc(Long mentorId);

    long countByStatus(MentorVerificationRequestStatus status);

    /**
     * Verification status distribution (PENDING / APPROVED / REJECTED) — feeds
     * the admin dashboard verification distribution chart.
     */
    @Query("SELECT r.status, COUNT(r) FROM MentorVerificationRequest r GROUP BY r.status")
    List<Object[]> countGroupedByStatus();
}
