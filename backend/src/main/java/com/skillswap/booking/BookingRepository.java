package com.skillswap.booking;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Collection;

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

        long countBySessionIdAndBookingStatusIn(Long sessionId, Collection<BookingStatus> statuses);

        long countByBookingStatus(BookingStatus status);

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
}
