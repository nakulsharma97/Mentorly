package com.mentorly.waitlist;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code SessionWaitlist} persistence.
 */
public interface SessionWaitlistRepository extends JpaRepository<SessionWaitlist, Long> {
    Optional<SessionWaitlist> findBySessionIdAndLearnerIdAndStatus(Long sessionId, Long learnerId,
            WaitlistStatus status);

    List<SessionWaitlist> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    Page<SessionWaitlist> findByLearnerIdOrderByCreatedAtDesc(Long learnerId, Pageable pageable);

    Optional<SessionWaitlist> findFirstBySessionIdAndStatusOrderByCreatedAtAsc(Long sessionId, WaitlistStatus status);

    long deleteBySessionId(Long sessionId);
}
