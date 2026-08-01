package com.skillswap.common;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    // ════════════════════════════════════════════════════════════════
    //  Activity Timeline & Security Audit (V47)
    // ════════════════════════════════════════════════════════════════

    /**
     * Server-side filtered + searched page. All params are optional; NULL/
     * blank values are ignored. {@code q} matches the action, details, admin
     * email, ip, browser, device and endpoint fields. Archived entries are
     * excluded unless {@code includeArchived} is true.
     */
    @Query("""
            SELECT a FROM AuditLog a WHERE
              (:action IS NULL OR :action = '' OR LOWER(a.action) LIKE LOWER(CONCAT('%', :action, '%')))
              AND (:module IS NULL OR :module = '' OR a.module = :module)
              AND (:severity IS NULL OR :severity = '' OR a.severity = :severity)
              AND (:outcome IS NULL OR :outcome = '' OR a.outcome = :outcome)
              AND (:entityType IS NULL OR :entityType = '' OR a.entityType = :entityType)
              AND (:userId IS NULL OR a.userId = :userId OR a.adminId = :userId)
              AND (:fromDate IS NULL OR a.createdAt >= :fromDate)
              AND (:toDate IS NULL OR a.createdAt <= :toDate)
              AND (:includeArchived = true OR a.archivedAt IS NULL)
              AND (:q IS NULL OR :q = '' OR
                   LOWER(a.action) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(a.details,'')) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(a.adminEmail,'')) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(a.ipAddress,'')) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(a.browser,'')) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(a.device,'')) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(COALESCE(a.endpoint,'')) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<AuditLog> findByFilters(
            @Param("action") String action,
            @Param("module") String module,
            @Param("severity") String severity,
            @Param("outcome") String outcome,
            @Param("entityType") String entityType,
            @Param("userId") Long userId,
            @Param("fromDate") OffsetDateTime fromDate,
            @Param("toDate") OffsetDateTime toDate,
            @Param("includeArchived") boolean includeArchived,
            @Param("q") String q,
            Pageable pageable);

    long countByArchivedAtIsNull();

    long countByCreatedAtAfter(OffsetDateTime after);

    long countByArchivedAtIsNullAndCreatedAtAfter(OffsetDateTime after);

    long countBySeverityAndCreatedAtAfter(String severity, OffsetDateTime after);

    long countByModuleAndArchivedAtIsNullAndCreatedAtAfter(String module, OffsetDateTime after);

    /** Actions actually performed by an admin account — the faithful "admin actions" measure. */
    long countByAdminIdIsNotNullAndArchivedAtIsNullAndCreatedAtAfter(OffsetDateTime after);

    @Query("SELECT a.severity, COUNT(a) FROM AuditLog a WHERE a.archivedAt IS NULL AND a.createdAt >= :since GROUP BY a.severity")
    List<Object[]> countGroupedBySeveritySince(@Param("since") OffsetDateTime since);

    @Query("SELECT a.module, COUNT(a) FROM AuditLog a WHERE a.archivedAt IS NULL AND a.createdAt >= :since GROUP BY a.module")
    List<Object[]> countGroupedByModuleSince(@Param("since") OffsetDateTime since);

    @Query(value = """
            SELECT DATE(a.created_at) AS d, COUNT(*) AS cnt FROM audit_logs a
            WHERE a.archived_at IS NULL AND a.created_at >= :since
            GROUP BY DATE(a.created_at) ORDER BY d ASC
            """, nativeQuery = true)
    List<Object[]> countDailyTrendSince(@Param("since") OffsetDateTime since);

    // ── Security alerts ──

    @Query("""
            SELECT a.ipAddress, COUNT(a) FROM AuditLog a
            WHERE a.action = 'FAILED_LOGIN' AND a.createdAt >= :since AND a.ipAddress IS NOT NULL
            GROUP BY a.ipAddress HAVING COUNT(a) >= 3 ORDER BY COUNT(a) DESC
            """)
    List<Object[]> repeatedFailedLoginsByIp(@Param("since") OffsetDateTime since);

    @Query("""
            SELECT a.userId, COUNT(a) FROM AuditLog a
            WHERE a.action = 'PASSWORD_RESET' AND a.createdAt >= :since AND a.userId IS NOT NULL
            GROUP BY a.userId HAVING COUNT(a) >= 2 ORDER BY COUNT(a) DESC
            """)
    List<Object[]> repeatedPasswordResets(@Param("since") OffsetDateTime since);

    @Query("""
            SELECT a.adminEmail, COUNT(a) FROM AuditLog a
            WHERE a.action = 'USER_DISABLE' AND a.createdAt >= :since AND a.adminEmail IS NOT NULL
            GROUP BY a.adminEmail HAVING COUNT(a) >= 2 ORDER BY COUNT(a) DESC
            """)
    List<Object[]> repeatedAccountDisables(@Param("since") OffsetDateTime since);

    @Query("SELECT a FROM AuditLog a WHERE a.action IN ('UPDATE_USER_ROLE','UPDATE_ADMIN_SUB_ROLE') AND a.createdAt >= :since ORDER BY a.createdAt DESC")
    List<AuditLog> privilegeChangesSince(@Param("since") OffsetDateTime since, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.severity IN ('ERROR','CRITICAL') AND a.createdAt >= :since ORDER BY a.createdAt DESC")
    List<AuditLog> errorsSince(@Param("since") OffsetDateTime since, Pageable pageable);

    // ── Retention ──

    @Modifying
    @Query("DELETE FROM AuditLog a WHERE a.archivedAt IS NULL AND a.createdAt < :cutoff")
    int purgeOlderThan(@Param("cutoff") OffsetDateTime cutoff);

    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.archivedAt IS NULL AND a.createdAt < :cutoff")
    long countExpired(@Param("cutoff") OffsetDateTime cutoff);
}
