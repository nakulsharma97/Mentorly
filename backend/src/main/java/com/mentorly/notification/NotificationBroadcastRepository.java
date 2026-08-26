package com.mentorly.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code NotificationBroadcast} persistence.
 */
public interface NotificationBroadcastRepository extends JpaRepository<NotificationBroadcast, Long> {

    /** Broadcasts that are not soft-deleted and are currently actionable. */
    List<NotificationBroadcast> findByDeletedAtIsNullOrderByCreatedAtDesc();

    /** Scheduled broadcasts whose schedule time has arrived and have not been sent yet. */
    @Query("SELECT b FROM NotificationBroadcast b WHERE b.deletedAt IS NULL "
            + "AND b.status = 'SCHEDULED' AND b.scheduleTime <= :now")
    List<NotificationBroadcast> findDueScheduled(@Param("now") OffsetDateTime now);

    /** A single non-deleted broadcast, for the detail panel and actions. */
    @Query("SELECT b FROM NotificationBroadcast b WHERE b.id = :id AND b.deletedAt IS NULL")
    Optional<NotificationBroadcast> findActiveById(@Param("id") Long id);

    // ── Dashboard stats ──

    long countByDeletedAtIsNull();

    long countByDeletedAtIsNullAndStatus(String status);

    long countByDeletedAtIsNullAndType(String type);

    /**
     * Paginated broadcast history with optional search + filters. Every
     * filter is optional; search matches title, subtitle, or message.
     */
    @Query("SELECT b FROM NotificationBroadcast b WHERE b.deletedAt IS NULL "
            + "AND (:type IS NULL OR b.type = :type) "
            + "AND (:priority IS NULL OR b.priority = :priority) "
            + "AND (:status IS NULL OR b.status = :status) "
            + "AND (:scope IS NULL OR b.targetScope = :scope) "
            + "AND (:q IS NULL OR :q = '' "
            + "OR LOWER(b.title) LIKE LOWER(CONCAT('%', :q, '%')) "
            + "OR LOWER(COALESCE(b.subtitle, '')) LIKE LOWER(CONCAT('%', :q, '%')) "
            + "OR LOWER(b.message) LIKE LOWER(CONCAT('%', :q, '%'))) "
            + "AND (:fromDate IS NULL OR b.createdAt >= :fromDate) "
            + "AND (:toDate IS NULL OR b.createdAt <= :toDate)")
    Page<NotificationBroadcast> findByFilters(
            @Param("type") String type,
            @Param("priority") String priority,
            @Param("status") String status,
            @Param("scope") String scope,
            @Param("q") String q,
            @Param("fromDate") OffsetDateTime fromDate,
            @Param("toDate") OffsetDateTime toDate,
            Pageable pageable);

    /**
     * Monthly broadcast-volume trend (campaigns created per month) — returns
     * [monthIndex (0=oldest), count] for the analytics chart.
     */
    @Query(value = "SELECT YEAR(b.created_at) * 100 + MONTH(b.created_at) AS ym, COUNT(*) AS cnt "
            + "FROM notification_broadcasts b WHERE b.deleted_at IS NULL AND b.created_at >= :since "
            + "GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
    List<Object[]> computeMonthlyTrend(@Param("since") OffsetDateTime since);
}
