package com.skillswap.safety;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Spring Data repository for {@code UserReport} persistence.
 */
public interface UserReportRepository extends JpaRepository<UserReport, Long> {
    List<UserReport> findByReporterIdOrderByCreatedAtDesc(Long reporterId);

    List<UserReport> findByStatusOrderByCreatedAtAsc(ReportStatus status);

    /**
     * Live (non-soft-deleted) reports in a status, oldest first — used by the
     * flagged-content queue and health KPI so spam-deleted reports never resurface.
     */
    List<UserReport> findByStatusAndDeletedAtIsNullOrderByCreatedAtAsc(ReportStatus status);

    /**
     * Reports matching a status and a target type (MENTOR, LEARNER, SESSION, SKILL),
     * oldest first — used by the admin moderation queue filter.
     */
    List<UserReport> findByStatusAndTargetTypeIgnoreCaseOrderByCreatedAtAsc(ReportStatus status, String targetType);

    /**
     * Count of live (non-soft-deleted) reports in a status — used by the admin
     * summary and health KPIs so soft-deleted spam never inflates the badges.
     */
    @Query("SELECT COUNT(r) FROM UserReport r WHERE r.deletedAt IS NULL AND r.status = :status")
    long countByStatus(@Param("status") ReportStatus status);

    /**
     * Paginated, multi-filter admin queue query. Every filter is optional —
     * pass {@code null} (or an empty string for {@code q}) to disable it.
     * Soft-deleted (spam) reports are always excluded. Search covers the
     * report id, reason, target label, reporter and reported user details.
     */
    /**
     * Reported user is nullable (session/skill reports), so the search join must
     * be a LEFT JOIN — an implicit inner join would silently drop reports whose
     * reported user is null even when no search term is applied.
     */
    @Query("SELECT r FROM UserReport r LEFT JOIN r.reported rep WHERE r.deletedAt IS NULL "
            + "AND (:status IS NULL OR r.status = :status) "
            + "AND (:targetType IS NULL OR :targetType = '' OR UPPER(r.targetType) = UPPER(:targetType)) "
            + "AND (:priority IS NULL OR r.priority = :priority) "
            + "AND (:fromDate IS NULL OR r.createdAt >= :fromDate) "
            + "AND (:toDate IS NULL OR r.createdAt <= :toDate) "
            + "AND (:q IS NULL OR :q = '' "
            + "OR CONCAT(r.id, '') LIKE CONCAT('%', COALESCE(:q, ''), '%') "
            + "OR LOWER(r.reason) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(r.targetLabel, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(r.reporter.fullName, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(r.reporter.email, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(rep.fullName, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(rep.email, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')))")
    Page<UserReport> findByFilters(
            @Param("status") ReportStatus status,
            @Param("targetType") String targetType,
            @Param("priority") ReportPriority priority,
            @Param("fromDate") OffsetDateTime fromDate,
            @Param("toDate") OffsetDateTime toDate,
            @Param("q") String q,
            Pageable pageable);

    /** Count of non-soft-deleted reports per status — feeds the dashboard stats. */
    @Query("SELECT r.status, COUNT(r) FROM UserReport r WHERE r.deletedAt IS NULL GROUP BY r.status")
    List<Object[]> countGroupedByStatus();

    /**
     * Monthly reports trend (live reports only) — returns [yearMonth, count]
     * ascending, feeds the admin dashboard reports trend chart.
     */
    @Query(value = "SELECT YEAR(r.created_at) * 100 + MONTH(r.created_at) AS ym, COUNT(*) AS cnt "
            + "FROM user_reports r WHERE r.created_at >= :since AND r.deleted_at IS NULL "
            + "GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
    List<Object[]> computeMonthlyTrend(@Param("since") OffsetDateTime since);

    /** Recent reports (newest first) — feeds the recent-activity timeline. */
    List<UserReport> findTop5ByOrderByCreatedAtDesc();
}
