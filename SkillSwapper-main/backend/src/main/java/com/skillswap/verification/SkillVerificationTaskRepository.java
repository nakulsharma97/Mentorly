package com.skillswap.verification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SkillVerificationTaskRepository extends JpaRepository<SkillVerificationTask, Long> {
    List<SkillVerificationTask> findByActiveTrue();

    List<SkillVerificationTask> findByMentorId(Long mentorId);
}
