package com.mentorly.verification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@code SkillVerificationSubmission} persistence.
 */
public interface SkillVerificationSubmissionRepository extends JpaRepository<SkillVerificationSubmission, Long> {
    List<SkillVerificationSubmission> findByLearnerId(Long learnerId);

    List<SkillVerificationSubmission> findByTaskMentorId(Long mentorId);
}
