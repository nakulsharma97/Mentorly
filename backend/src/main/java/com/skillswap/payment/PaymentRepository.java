package com.skillswap.payment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

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

    // ── Admin pagination queries ──
    @Query("SELECT p FROM Payment p WHERE "
            + "(:status IS NULL OR :status = '' OR UPPER(p.status) = UPPER(:status)) "
            + "AND (:gateway IS NULL OR :gateway = '' OR LOWER(p.gateway) = LOWER(:gateway)) "
            + "AND (:q IS NULL OR :q = '' "
            + "OR CONCAT(p.id, '') LIKE CONCAT('%', COALESCE(:q, ''), '%') "
            + "OR LOWER(p.orderId) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Payment> findByFilters(@Param("status") String status,
                                @Param("gateway") String gateway,
                                @Param("q") String q,
                                Pageable pageable);

    /**
     * Compute payment aggregates grouped by status in a single query.
     * Returns rows of [status, SUM(amount), COUNT(*)].
     * Eliminates the N+1 +O(N) memory pattern from AdminController.listPayments().
     */
    @Query("SELECT p.status AS status, COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS cnt "
            + "FROM Payment p GROUP BY p.status")
    List<Object[]> computeAggregates();

    /**
     * Monthly signup trend - returns [monthIndex (0=oldest), count] for the last N months.
     */
    @Query(value = "SELECT YEAR(u.created_at) * 100 + MONTH(u.created_at) AS ym, COUNT(*) AS cnt "
            + "FROM users u WHERE u.created_at >= :since GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
    List<Object[]> computeMonthlySignupTrend(@Param("since") java.time.OffsetDateTime since);

    /**
     * Monthly released-payment revenue trend - returns [monthIndex, sum(amount)].
     */
    @Query(value = "SELECT YEAR(p.created_at) * 100 + MONTH(p.created_at) AS ym, COALESCE(SUM(p.amount), 0) AS total "
            + "FROM payments p WHERE p.status = 'RELEASED' AND p.created_at >= :since "
            + "GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
    List<Object[]> computeMonthlyRevenueTrend(@Param("since") java.time.OffsetDateTime since);

    /**
     * Monthly completed-bookings trend - returns [monthIndex, count] for the last N months.
     */
    @Query(value = "SELECT YEAR(b.created_at) * 100 + MONTH(b.created_at) AS ym, COUNT(*) AS cnt "
            + "FROM bookings b WHERE b.booking_status = 'COMPLETED' AND b.created_at >= :since "
            + "GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
    List<Object[]> computeMonthlySessionTrend(@Param("since") java.time.OffsetDateTime since);
}

