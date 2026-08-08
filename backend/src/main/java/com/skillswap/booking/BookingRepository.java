package com.skillswap.booking;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Collection;

/**
 * Spring Data repository for {@code Booking} persistence.
 */
public interface BookingRepository extends JpaRepository<Booking, Long> {
        long countBySessionMentorId(Long mentorId);

        List<Booking> findBySessionMentorId(Long mentorId);

        long countBySessionMentorIdAndBookingStatus(Long mentorId, BookingStatus status);

        List<Booking> findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                        Long learnerId,
                        Long mentorId,
                        BookingStatus bookingStatus);

        List<Booking> findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                        Long mentorId,
                        Long learnerId,
                        BookingStatus bookingStatus);

        long countBySessionId(Long sessionId);

        long countBySessionIdAndBookingStatusIn(Long sessionId, Collection<BookingStatus> statuses);

        long countByBookingStatus(BookingStatus status);

        /** Bookings created since a timestamp — feeds monitoring “today’s bookings”. */
        long countByCreatedAtAfter(OffsetDateTime createdAt);

        boolean existsBySessionIdAndLearnerIdAndBookingStatusIn(Long sessionId, Long learnerId,
                        Collection<BookingStatus> statuses);

        List<Booking> findByBookingStatusInAndSessionStartTimeLessThanEqual(Collection<BookingStatus> statuses,
                        OffsetDateTime startTime);

        List<Booking> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

        long countByLearnerIdAndBookingStatus(Long learnerId, BookingStatus status);

        List<Booking> findBySessionId(Long sessionId);

        List<Booking> findBySessionMentorIdAndBookingStatus(Long mentorId, BookingStatus status);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT COUNT(b) FROM Booking b WHERE b.session.id = :sessionId AND b.bookingStatus IN :statuses")
        long countActiveBySessionIdWithLock(@Param("sessionId") Long sessionId,
                @Param("statuses") Collection<BookingStatus> statuses);

        @Query("SELECT b FROM Booking b WHERE b.id IN :ids AND b.session.id = :sessionId AND b.bookingStatus = :status")
        List<Booking> findByIdsAndSessionIdAndStatus(@Param("ids") List<Long> ids,
                @Param("sessionId") Long sessionId, @Param("status") BookingStatus status);

        List<Booking> findBySessionIdAndApprovedByAdminTrue(Long sessionId);

        java.util.Optional<Booking> findBySessionIdAndLearnerIdAndApprovedByAdminTrue(Long sessionId, Long learnerId);

        long countBySessionIdAndApprovedByAdminTrue(Long sessionId);

        long countBySessionIdAndBookingStatus(Long sessionId, BookingStatus status);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.session.id = :sessionId AND b.bookingStatus = :status "
                + "AND (b.approvedByAdmin IS NULL OR b.approvedByAdmin = false)")
        long countPendingNotApprovedBySessionId(@Param("sessionId") Long sessionId,
                @Param("status") BookingStatus status);

        /**
         * Monthly booking-volume trend across ALL statuses (pending, accepted,
         * completed, cancelled…) — returns [monthIndex (0=oldest), count]. Used
         * together with {@link #computeMonthlyCompletedTrend} to derive the
         * per-month session completion rate for the admin analytics dashboard.
         */
        @Query(value = "SELECT YEAR(b.created_at) * 100 + MONTH(b.created_at) AS ym, COUNT(*) AS cnt "
                + "FROM bookings b WHERE b.created_at >= :since GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
        List<Object[]> computeMonthlyBookingTrend(@Param("since") OffsetDateTime since);

        /**
         * Most active mentors ranked by number of bookings they received —
         * returns [mentorId, bookingCount] ordered desc, limited to 10.
         */
        @Query(value = "SELECT s.mentor_id AS mentorId, COUNT(b.id) AS cnt "
                + "FROM bookings b JOIN sessions s ON b.session_id = s.id "
                + "WHERE s.mentor_id IS NOT NULL GROUP BY s.mentor_id ORDER BY cnt DESC LIMIT 10", nativeQuery = true)
        List<Object[]> countTopMentorBookings();

        /**
         * Most active learners ranked by number of bookings they made — returns
         * [learnerId, bookingCount] ordered desc, limited to 10.
         */
        @Query(value = "SELECT b.learner_id AS learnerId, COUNT(b.id) AS cnt "
                + "FROM bookings b WHERE b.learner_id IS NOT NULL "
                + "GROUP BY b.learner_id ORDER BY cnt DESC LIMIT 10", nativeQuery = true)
        List<Object[]> countTopLearnerBookings();

        /**
         * Recent completed bookings (newest first) — feeds the recent-activity timeline.
         */
        List<Booking> findTop5ByBookingStatusOrderByCreatedAtDesc(BookingStatus status);

        /**
         * Paginated, searchable session history for one learner. Supports an
         * optional status filter and a keyword search over the session title and
         * mentor name. Rows are ordered by the actual session time (falling back
         * to the booking creation time) so the newest activity surfaces first.
         *
         * @param learnerId the owning learner
         * @param status    optional status filter (null = all)
         * @param search    optional keyword over session title / mentor name
         * @param pageable  paging + size
         */
        @Query("SELECT b FROM Booking b JOIN b.session s LEFT JOIN s.mentor m "
                + "WHERE b.learner.id = :learnerId "
                + "AND (:status IS NULL OR b.bookingStatus = :status) "
                + "AND (:search IS NULL OR :search = '' "
                + "   OR LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) "
                + "   OR (m IS NOT NULL AND LOWER(m.fullName) LIKE LOWER(CONCAT('%', :search, '%')))) "
                + "ORDER BY COALESCE(s.endTime, b.createdAt) DESC")
        Page<Booking> searchLearnerHistory(@Param("learnerId") Long learnerId,
                @Param("status") BookingStatus status,
                @Param("search") String search,
                Pageable pageable);
}
