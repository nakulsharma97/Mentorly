package com.mentorly.session;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.mentorly.booking.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code Session} persistence.
 */
public interface SessionRepository extends JpaRepository<SkillSession, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SkillSession s where s.id = :id")
    Optional<SkillSession> findByIdWithLock(@Param("id") Long id);

    List<SkillSession> findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(Long mentorId, OffsetDateTime startTime);

    List<SkillSession> findByMentorId(Long mentorId);

    /**
     * Paginated sessions for one mentor. The List overload above is kept for
     * any internal callers; the HTTP layer uses this Page variant.
     */
    Page<SkillSession> findByMentorId(Long mentorId, Pageable pageable);

    @Query("select b.session from Booking b where b.learner.id = :learnerId order by b.createdAt desc")
    List<SkillSession> findByLearnerIdOrderByBookingCreatedAtDesc(Long learnerId);

    @Query("select b.session from Booking b where b.learner.id = :learnerId order by b.createdAt desc")
    Page<SkillSession> findByLearnerIdOrderByBookingCreatedAtDesc(Long learnerId, Pageable pageable);

    @Query("select min(s.priceAmount) from SkillSession s where s.mentor.id = :mentorId")
    BigDecimal findMinPriceByMentorId(Long mentorId);

    @Query("select s.mentor.id, min(s.priceAmount) from SkillSession s"
            + " where s.mentor.id in :mentorIds group by s.mentor.id")
    List<Object[]> findMinPriceByMentorIdsIn(
            @Param("mentorIds") java.util.Collection<Long> mentorIds);

    boolean existsByMentorIdAndStartTime(Long mentorId, OffsetDateTime startTime);

    long countByStatus(SessionStatus status);

    /**
     * Upcoming sessions: ACCEPTED sessions whose startTime is in the future.
     */
    @Query("SELECT COUNT(s) FROM SkillSession s WHERE s.status = 'ACCEPTED' AND s.startTime > CURRENT_TIMESTAMP")
    long countUpcoming();

    /**
     * Ongoing sessions: ACCEPTED sessions where now is between startTime and endTime.
     */
    @Query("SELECT COUNT(s) FROM SkillSession s WHERE s.status = 'ACCEPTED' AND s.startTime <= CURRENT_TIMESTAMP AND s.endTime >= CURRENT_TIMESTAMP")
    long countOngoing();

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

    // ──────────────────────────────────────────────────────────────────────
    // Public / Private 1:1 session discovery
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Currently discoverable PUBLIC sessions: public, not cancelled/completed,
     * starting in the future, and not already claimed by a learner (no active
     * booking in the {@code activeStatuses} set — including COMPLETED so a
     * finished session can never be re-booked).
     */
    @Query("""
            SELECT s FROM SkillSession s
            WHERE s.sessionType = com.mentorly.session.SessionType.PUBLIC
              AND s.status NOT IN (com.mentorly.session.SessionStatus.CANCELLED,
                                   com.mentorly.session.SessionStatus.COMPLETED)
              AND s.startTime > :now
              AND NOT EXISTS (
                  SELECT b FROM Booking b
                  WHERE b.session = s
                    AND b.bookingStatus IN :activeStatuses
              )
            """)
    Page<SkillSession> findAvailablePublicSessions(@Param("now") OffsetDateTime now,
            @Param("activeStatuses") Collection<BookingStatus> activeStatuses,
            Pageable pageable);

    /**
     * Available PUBLIC sessions for one mentor's public profile. Excludes
     * PRIVATE sessions, booked/completed/cancelled sessions, and past slots.
     */
    @Query("""
            SELECT s FROM SkillSession s
            WHERE s.mentor.id = :mentorId
              AND s.sessionType = com.mentorly.session.SessionType.PUBLIC
              AND s.status NOT IN (com.mentorly.session.SessionStatus.CANCELLED,
                                   com.mentorly.session.SessionStatus.COMPLETED)
              AND s.startTime > :now
              AND NOT EXISTS (
                  SELECT b FROM Booking b
                  WHERE b.session = s
                    AND b.bookingStatus IN :activeStatuses
              )
            """)
    List<SkillSession> findAvailablePublicSessionsByMentorId(@Param("mentorId") Long mentorId,
            @Param("now") OffsetDateTime now,
            @Param("activeStatuses") Collection<BookingStatus> activeStatuses);

    /**
     * Available PRIVATE sessions assigned to one learner (their “For You”
     * list): private, targeted at this learner, not cancelled/completed, in
     * the future, and not already booked by the learner.
     */
    @Query("""
            SELECT s FROM SkillSession s
            WHERE s.sessionType = com.mentorly.session.SessionType.PRIVATE
              AND s.targetLearner.id = :learnerId
              AND s.status NOT IN (com.mentorly.session.SessionStatus.CANCELLED,
                                   com.mentorly.session.SessionStatus.COMPLETED)
              AND s.startTime > :now
              AND NOT EXISTS (
                  SELECT b FROM Booking b
                  WHERE b.session = s
                    AND b.bookingStatus IN :activeStatuses
              )
            """)
    List<SkillSession> findAvailablePrivateSessionsForLearner(@Param("learnerId") Long learnerId,
            @Param("now") OffsetDateTime now,
            @Param("activeStatuses") Collection<BookingStatus> activeStatuses);

    /** All PRIVATE sessions created by one mentor (any state — for the mentor's own management view). */
    List<SkillSession> findByMentorIdAndSessionType(Long mentorId, SessionType sessionType);

    /** Paginated sessions of one visibility class (admin views). */
    Page<SkillSession> findBySessionType(SessionType sessionType, Pageable pageable);
}
