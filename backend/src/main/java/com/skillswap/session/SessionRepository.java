package com.skillswap.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

public interface SessionRepository extends JpaRepository<SkillSession, Long> {
    List<SkillSession> findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(Long mentorId, OffsetDateTime startTime);
}
