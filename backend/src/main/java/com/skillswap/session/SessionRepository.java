package com.skillswap.session;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<SkillSession, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SkillSession s where s.id = :id")
    Optional<SkillSession> findByIdWithLock(@Param("id") Long id);

    List<SkillSession> findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(Long mentorId, OffsetDateTime startTime);

    List<SkillSession> findByMentorId(Long mentorId);

    @Query("select b.session from Booking b where b.learner.id = :learnerId order by b.createdAt desc")
    List<SkillSession> findByLearnerIdOrderByBookingCreatedAtDesc(Long learnerId);

    @Query("select min(s.priceAmount) from SkillSession s where s.mentor.id = :mentorId")
    BigDecimal findMinPriceByMentorId(Long mentorId);

    boolean existsByMentorIdAndStartTime(Long mentorId, OffsetDateTime startTime);

    long countByStatus(SessionStatus status);

    /**
     * Session status distribution (PENDING / ACCEPTED / COMPLETED / CANCELLED) —
     * feeds the admin dashboard distribution chart.
     */
    @Query("SELECT s.status, COUNT(s) FROM SkillSession s GROUP BY s.status")
    List<Object[]> countGroupedByStatus();

    // ── Admin pagination queries ──
    @Query("SELECT s FROM SkillSession s WHERE "
            + "(:status IS NULL OR s.status = :status) "
            + "AND (:q IS NULL OR :q = '' "
            + "OR LOWER(s.title) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR (s.mentor IS NOT NULL AND LOWER(s.mentor.fullName) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%'))))")
    Page<SkillSession> findByFilters(@Param("status") SessionStatus status,
                                     @Param("q") String q,
                                     Pageable pageable);
}
