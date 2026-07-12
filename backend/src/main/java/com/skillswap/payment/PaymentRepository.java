package com.skillswap.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByLearnerIdOrMentorId(Long learnerId, Long mentorId);

    List<Payment> findByMentorIdAndCreatedAtGreaterThanEqual(Long mentorId, OffsetDateTime createdAt);

    List<Payment> findByLearnerIdAndCreatedAtGreaterThanEqual(Long learnerId, OffsetDateTime createdAt);

    List<Payment> findBySessionId(Long sessionId);

    Optional<Payment> findByPaymentId(String paymentId);

    Optional<Payment> findByOrderId(String orderId);
}
