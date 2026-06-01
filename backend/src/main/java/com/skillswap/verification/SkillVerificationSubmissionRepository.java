package com.skillswap.verification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SkillVerificationSubmissionRepository extends JpaRepository<SkillVerificationSubmission, Long> {
    List<SkillVerificationSubmission> findByLearnerId(Long learnerId);

    List<SkillVerificationSubmission> findByTaskMentorId(Long mentorId);
}
