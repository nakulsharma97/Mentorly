package com.skillswap.booking;

import org.springframework.data.jpa.repository.JpaRepository;

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

        boolean existsBySessionIdAndLearnerIdAndBookingStatusIn(Long sessionId, Long learnerId,
                        Collection<BookingStatus> statuses);

        List<Booking> findByBookingStatusInAndSessionStartTimeLessThanEqual(Collection<BookingStatus> statuses,
                        OffsetDateTime startTime);

        List<Booking> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

        long countByLearnerIdAndBookingStatus(Long learnerId, BookingStatus status);

        List<Booking> findBySessionMentorIdAndBookingStatus(Long mentorId, BookingStatus status);
}
