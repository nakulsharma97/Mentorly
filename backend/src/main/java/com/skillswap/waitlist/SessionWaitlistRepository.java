package com.skillswap.waitlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionWaitlistRepository extends JpaRepository<SessionWaitlist, Long> {
    Optional<SessionWaitlist> findBySessionIdAndLearnerIdAndStatus(Long sessionId, Long learnerId,
            WaitlistStatus status);

    List<SessionWaitlist> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    Optional<SessionWaitlist> findFirstBySessionIdAndStatusOrderByCreatedAtAsc(Long sessionId, WaitlistStatus status);

    long deleteBySessionId(Long sessionId);
}
