package com.skillswap.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public interface SessionRepository extends JpaRepository<SkillSession, Long> {
    List<SkillSession> findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(Long mentorId, OffsetDateTime startTime);

    List<SkillSession> findByMentorId(Long mentorId);

    @Query("select b.session from Booking b where b.learner.id = :learnerId order by b.createdAt desc")
    List<SkillSession> findByLearnerIdOrderByBookingCreatedAtDesc(Long learnerId);

    @Query("select min(s.priceAmount) from SkillSession s where s.mentor.id = :mentorId")
    BigDecimal findMinPriceByMentorId(Long mentorId);
}
