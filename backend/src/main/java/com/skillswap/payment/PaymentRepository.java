package com.skillswap.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByBookingId(Long bookingId);

    List<Payment> findByBookingLearnerIdOrBookingSessionMentorId(Long learnerId, Long mentorId);

    List<Payment> findByBookingSessionMentorIdAndCreatedAtGreaterThanEqual(Long mentorId,
            java.time.OffsetDateTime createdAt);

    List<Payment> findByBookingLearnerIdAndCreatedAtGreaterThanEqual(Long learnerId,
            java.time.OffsetDateTime createdAt);
}
