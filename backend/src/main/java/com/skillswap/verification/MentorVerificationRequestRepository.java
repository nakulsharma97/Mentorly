package com.skillswap.verification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentorVerificationRequestRepository extends JpaRepository<MentorVerificationRequest, Long> {
    List<MentorVerificationRequest> findByMentorIdOrderByCreatedAtDesc(Long mentorId);

    List<MentorVerificationRequest> findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus status);
}
