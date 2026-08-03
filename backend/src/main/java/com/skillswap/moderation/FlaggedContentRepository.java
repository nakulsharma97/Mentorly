package com.skillswap.moderation;

import com.skillswap.safety.ReportPriority;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code FlaggedContent} persistence.
 */
public interface FlaggedContentRepository extends JpaRepository<FlaggedContent, Long> {

    /**
     * Paginated moderation queue with every filter optional. Soft-deleted
     * (removed) items are always excluded. Search covers the report id,
     * content preview, reason, and owner / reporter names and emails.
     * The reported-content owner is nullable, so the search join is a LEFT JOIN.
     */
    /**
     * {@code open-in-view: false} — the owner / reporter / moderator are LAZY
     * and the controller maps entities to DTOs outside the repository call, so
     * an {@code @EntityGraph} is required to initialize them in the query.
     */
    @EntityGraph(attributePaths = {"owner", "reporter", "assignedModerator"})
    @Query("SELECT f FROM FlaggedContent f "
            + "LEFT JOIN f.owner own LEFT JOIN f.reporter rep "
            + "WHERE f.deletedAt IS NULL "
            + "AND (:status IS NULL OR f.status = :status) "
            + "AND (:contentType IS NULL OR f.contentType = :contentType) "
            + "AND (:priority IS NULL OR f.priority = :priority) "
            + "AND (:detectionSource IS NULL OR f.detectionSource = :detectionSource) "
            + "AND (:reporterId IS NULL OR f.reporter.id = :reporterId) "
            + "AND (:ownerId IS NULL OR f.owner.id = :ownerId) "
            + "AND (:fromDate IS NULL OR f.createdAt >= :fromDate) "
            + "AND (:toDate IS NULL OR f.createdAt <= :toDate) "
            + "AND (:q IS NULL OR :q = '' "
            + "OR CONCAT(f.id, '') LIKE CONCAT('%', COALESCE(:q, ''), '%') "
            + "OR LOWER(COALESCE(f.contentPreview, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(f.reason) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(own.fullName, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(own.email, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(rep.fullName, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
            + "OR LOWER(COALESCE(rep.email, '')) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')))")
    Page<FlaggedContent> findByFilters(
            @Param("status") ModerationStatus status,
            @Param("contentType") ContentType contentType,
            @Param("priority") ReportPriority priority,
            @Param("detectionSource") DetectionSource detectionSource,
            @Param("reporterId") Long reporterId,
            @Param("ownerId") Long ownerId,
            @Param("fromDate") OffsetDateTime fromDate,
            @Param("toDate") OffsetDateTime toDate,
            @Param("q") String q,
            Pageable pageable);

    /** Count of live (non-soft-deleted) items per status — feeds dashboard cards. */
    @Query("SELECT f.status, COUNT(f) FROM FlaggedContent f WHERE f.deletedAt IS NULL GROUP BY f.status")
    List<Object[]> countGroupedByStatus();

    /** Count of live items per priority — feeds the High / Critical cards. */
    @Query("SELECT f.priority, COUNT(f) FROM FlaggedContent f WHERE f.deletedAt IS NULL GROUP BY f.priority")
    List<Object[]> countGroupedByPriority();

    /** Items decided today (terminal statuses updated since local start-of-day) — "Resolved today" card. */
    @Query("SELECT COUNT(f) FROM FlaggedContent f WHERE f.deletedAt IS NULL "
            + "AND f.status IN :terminalStatuses AND f.updatedAt >= :startOfDay")
    long countDecidedSince(@Param("terminalStatuses") List<ModerationStatus> terminalStatuses,
            @Param("startOfDay") OffsetDateTime startOfDay);

    /**
     * Loads a single flagged item with its user associations initialized — used
     * by the service so detail responses never touch lazy proxies outside the
     * repository transaction.
     */
    @EntityGraph(attributePaths = {"owner", "reporter", "assignedModerator"})
    Optional<FlaggedContent> findWithDetailsById(Long id);

    /** Count of live (non-soft-deleted) flagged items — feeds dashboard cards. */
    long countByDeletedAtIsNull();

    /**
     * Monthly flagged-content trend (live items only) — returns [yearMonth,
     * count] ascending, feeds the admin dashboard flagged trend chart.
     */
    @Query(value = "SELECT YEAR(f.created_at) * 100 + MONTH(f.created_at) AS ym, COUNT(*) AS cnt "
            + "FROM flagged_content f WHERE f.created_at >= :since AND f.deleted_at IS NULL "
            + "GROUP BY ym ORDER BY ym ASC", nativeQuery = true)
    List<Object[]> computeMonthlyTrend(@Param("since") OffsetDateTime since);

    /** Recent flagged items (newest first) — feeds the recent-activity timeline. */
    List<FlaggedContent> findTop5ByOrderByCreatedAtDesc();
}
