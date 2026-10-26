package com.mentorly.booking;

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

        /**
         * Paginated bookings for one mentor. The List overload above is kept
         * for internal aggregate callers (analytics, chat, live sessions); the
         * HTTP layer uses this Page variant.
         */
        Page<Booking> findBySessionMentorId(Long mentorId, Pageable pageable);

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

        List<Booking> findByBookingStatusIn(Collection<BookingStatus> statuses);

        List<Booking> findByCompletionReviewStatus(CompletionReviewStatus status);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.learner.id = :userId AND b.completionReviewStatus IN :statuses")
        long countByLearnerIdAndCompletionReviewStatusIn(@Param("userId") Long userId,
                        @Param("statuses") Collection<CompletionReviewStatus> statuses);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.session.mentor.id = :mentorId AND b.completionReviewStatus IN :statuses")
        long countByMentorIdAndCompletionReviewStatusIn(@Param("mentorId") Long mentorId,
                        @Param("statuses") Collection<CompletionReviewStatus> statuses);

        List<Booking> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

        /**
         * Paginated bookings for one learner. The List overload above is kept
         * for internal aggregate callers (dashboard, tasks, analytics); the
         * HTTP layer uses this Page variant.
         */
        Page<Booking> findByLearnerIdOrderByCreatedAtDesc(Long learnerId, Pageable pageable);

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
         * Completed-session totals for a SET of users in ONE grouped query:
         * each id is counted as a learner (bookings it made) and as a mentor
         * (bookings on its sessions), summed together. Returns [userId, count]
         * pairs — ids with no completed sessions simply have no row.
         *
         * Used by the public testimonials list so it never issues one count
         * query per review (the old N+1). {@code status} is passed as
         * {@code BookingStatus.name()} so the native query binds a plain
         * string against the STRING-mapped booking_status column.
         *
         * @param userIds the author ids to count for (must not be empty)
         * @param status  booking status name, e.g. {@code "COMPLETED"}
         */
        @Query(value = "SELECT id, SUM(cnt) FROM ("
                + "SELECT learner_id AS id, COUNT(*) AS cnt FROM bookings "
                + "WHERE learner_id IN (:userIds) AND booking_status = :status GROUP BY learner_id "
                + "UNION ALL "
                + "SELECT s.mentor_id AS id, COUNT(*) AS cnt FROM bookings b "
                + "JOIN sessions s ON b.session_id = s.id "
                + "WHERE s.mentor_id IN (:userIds) AND b.booking_status = :status GROUP BY s.mentor_id"
                + ") u GROUP BY id", nativeQuery = true)
        List<Object[]> countCompletedSessionsByUserIdsIn(
                        @Param("userIds") Collection<Long> userIds,
                        @Param("status") String status);

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
