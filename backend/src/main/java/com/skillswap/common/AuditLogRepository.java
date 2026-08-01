package com.skillswap.common;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AuditLog> findByActionOrderByCreatedAtDesc(String action);

    List<AuditLog> findByResourceAndResourceIdOrderByCreatedAtDesc(String resource, Long resourceId);

    List<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(OffsetDateTime start, OffsetDateTime end);

    // ── Admin-specific queries ──

    List<AuditLog> findByAdminIdOrderByCreatedAtDesc(Long adminId, Pageable pageable);

    List<AuditLog> findByActionContainingIgnoreCaseOrderByCreatedAtDesc(String action, Pageable pageable);

    long countByActionContainingIgnoreCase(String action);

    long countByActionContainingIgnoreCaseAndCreatedAtAfter(String action, OffsetDateTime after);

    /** Recent log entries containing a keyword — feeds the monitoring log viewer. */
    List<AuditLog> findByActionContainingIgnoreCaseAndCreatedAtAfterOrderByCreatedAtDesc(
            String action, OffsetDateTime after, Pageable pageable);

    /**
     * Daily count of audit entries whose action contains a keyword (e.g. ERROR)
     * — feeds the error-trend chart on the monitoring dashboard. Returns
     * [DATE, count] ascending.
     */
    @Query(value = "SELECT DATE(a.created_at) AS d, COUNT(*) AS cnt FROM audit_logs a "
            + "WHERE a.created_at >= :since AND LOWER(a.action) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "GROUP BY DATE(a.created_at) ORDER BY d ASC", nativeQuery = true)
    List<Object[]> countDailyByActionContaining(@Param("since") OffsetDateTime since,
            @Param("keyword") String keyword);

    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId, Pageable pageable);

    /** Recent admin actions (newest first) — feeds the recent-activity timeline. */
    List<AuditLog> findTop10ByOrderByCreatedAtDesc();
}
