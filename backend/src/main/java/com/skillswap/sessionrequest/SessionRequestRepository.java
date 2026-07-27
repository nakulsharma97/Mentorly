package com.skillswap.sessionrequest;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionRequestRepository extends JpaRepository<SessionRequest, Long> {

    List<SessionRequest> findByMentorIdAndStatusOrderByCreatedAtDesc(Long mentorId, SessionRequestStatus status);

    List<SessionRequest> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    Optional<SessionRequest> findByIdAndMentorId(Long id, Long mentorId);

    Optional<SessionRequest> findByIdAndLearnerId(Long id, Long learnerId);

    boolean existsByLearnerIdAndMentorIdAndStatus(Long learnerId, Long mentorId, SessionRequestStatus status);

    List<SessionRequest> findByMentorIdAndReplyMessageIsNotNull(Long mentorId);
}
