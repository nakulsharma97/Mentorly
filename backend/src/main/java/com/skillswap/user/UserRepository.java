package com.skillswap.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code User} persistence.
 */
public interface UserRepository extends JpaRepository<User, Long> {

      @Lock(LockModeType.PESSIMISTIC_WRITE)
      @Query("SELECT u FROM User u WHERE u.id = :userId")
      Optional<User> findByIdWithLock(@Param("userId") Long userId);

      Optional<User> findByEmail(String email);

      Optional<User> findByUsername(String username);

      boolean existsByUsername(String username);

      Optional<User> findByReferralCodeIgnoreCase(String referralCode);

      Optional<User> findByPasswordResetToken(String passwordResetToken);

      boolean existsByEmail(String email);

      boolean existsByReferralCodeIgnoreCase(String referralCode);

      long countByReferredByUserId(Long referredByUserId);

      long countByRole(UserRole role);

      long countByEnabledFalse();

      long countByMentorVerifiedTrue();

      long countByReferralCodeIsNotNull();

      /**
       * Recent signups (newest first) — feeds the admin dashboard recent-activity
       * timeline without loading the full user table.
       */
      List<User> findTop5ByOrderByCreatedAtDesc();

      /**
       * Signups per day for the last N days — returns [DATE, count] ascending,
       * used by the daily-signup trend and activity heatmap.
       */
      @Query(value = "SELECT DATE(u.created_at) AS d, COUNT(*) AS cnt FROM users u "
                  + "WHERE u.created_at >= :since GROUP BY DATE(u.created_at) ORDER BY d ASC", nativeQuery = true)
      List<Object[]> countDailySignups(@Param("since") OffsetDateTime since);

      /**
       * Daily active users (last_active_at) — returns [DATE, count] ascending,
       * used by the daily-login trend on the admin dashboard.
       */
      @Query(value = "SELECT DATE(u.last_active_at) AS d, COUNT(*) AS cnt FROM users u "
                  + "WHERE u.last_active_at >= :since GROUP BY DATE(u.last_active_at) ORDER BY d ASC", nativeQuery = true)
      List<Object[]> countDailyActive(@Param("since") OffsetDateTime since);

      List<User> findByRole(UserRole role);

      Page<User> findByRole(UserRole role, Pageable pageable);

      List<User> findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole role);

      /**
       * Verified mentors (role MENTOR + mentorVerified) — broadcast audience scope.
       */
      List<User> findByRoleAndMentorVerifiedTrueAndEnabledTrue(UserRole role);

      /** Mentors that are NOT yet verified — broadcast audience scope. */
      List<User> findByRoleAndMentorVerifiedFalseAndEnabledTrue(UserRole role);

      List<User> findByRoleAndEnabledTrueAndSkillsContainingIgnoreCaseOrderByLastActiveAtDesc(UserRole role,
                  String skill);

      List<User> findByRoleAndEnabledTrueAndLastActiveAtAfterOrderByLastActiveAtDesc(UserRole role,
                  OffsetDateTime cutoff);

      long countByLastActiveAtAfter(OffsetDateTime cutoff);

      /**
       * Active users of a specific role since a cutoff — feeds monitoring “online
       * mentors/learners”.
       */
      long countByRoleAndLastActiveAtAfter(UserRole role, OffsetDateTime cutoff);

      long countByCreatedAtAfter(OffsetDateTime cutoff);

      /**
       * Returns the raw (comma/newline separated) skills column for every
       * mentor so the admin analytics dashboard can rank the most in-demand
       * skills without loading full user entities.
       *
       * @return non-null skills strings, one per mentor who has set skills
       */
      @Query("SELECT u.skills FROM User u WHERE u.role = :role AND u.skills IS NOT NULL AND u.skills <> ''")
      List<String> findSkillsByRole(@Param("role") UserRole role);

      @Modifying
      @Query("UPDATE User u SET u.lastActiveAt = :now WHERE u.email = :email")
      int updateLastActiveAt(@Param("email") String email, @Param("now") OffsetDateTime now);

      // ── Bulk operations (avoids N+1 for admin actions) ──

      @Modifying
      @Query("UPDATE User u SET u.enabled = :enabled WHERE u.id IN :ids")
      int updateEnabledBatch(@Param("ids") List<Long> ids, @Param("enabled") boolean enabled);

      @Modifying
      @Query("UPDATE User u SET u.role = :role WHERE u.id IN :ids")
      int updateRoleBatch(@Param("ids") List<Long> ids, @Param("role") UserRole role);

      @Modifying
      @Query("UPDATE User u SET u.mentorVerified = false WHERE u.id IN :ids")
      int resetMentorVerifiedBatch(@Param("ids") List<Long> ids);

      // ── Admin pagination queries ──
      @Query("SELECT u FROM User u WHERE "
                  + "(:role IS NULL OR u.role = :role) "
                  + "AND (:q IS NULL OR :q = '' "
                  + "OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
                  + "OR LOWER(u.email) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
                  + "OR LOWER(u.username) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')))")
      Page<User> findByFilters(@Param("role") UserRole role,
                  @Param("q") String q,
                  Pageable pageable);

      /**
       * Backend-driven mentor search with keyword matching, price / rating /
       * experience filters, "online now" and "saved by learner" scopes, and a
       * server-side {@code sort} switch. Every filter is optional: pass
       * {@code null} (or 0) to disable it. Sorting is resolved entirely in SQL so
       * the frontend never re-orders results.
       *
       * <p>
       * Supported {@code sort} values: {@code rating}, {@code experience},
       * {@code price}, {@code availability}, {@code newest}. Any other value
       * (including {@code recent}) falls back to most-recently-active first.
       */
      /**
       * Search users (both MENTOR and LEARNER) by name, email, or about_me.
       * Used by the global topbar search to find people quickly.
       */
      @Query(value = """
                  SELECT DISTINCT u.* FROM users u
                  WHERE u.enabled = true
                    AND (
                          LOWER(u.full_name) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                          OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                          OR LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                    )
                  ORDER BY
                    CASE WHEN u.role = 'MENTOR' THEN 0 ELSE 1 END,
                    u.last_active_at DESC
                  LIMIT :limit
                  """, nativeQuery = true)
      List<User> searchUsersByName(@Param("keyword") String keyword, @Param("limit") int limit);

      /**
       * Rich people search for messaging/new-conversation discovery.
       * Matches by name, username, email, role, skills, about, company,
       * headline and years of experience.
       */
      @Query(value = """
                  SELECT DISTINCT u.* FROM users u
                  WHERE u.enabled = true
                        AND (
                                          :keyword IS NULL OR :keyword = ''
                                          OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(COALESCE(u.skills, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(COALESCE(u.about_me, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(COALESCE(u.company, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(COALESCE(u.headline, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR LOWER(COALESCE(u.role, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\'
                                          OR CAST(COALESCE(u.years_of_experience, 0) AS CHAR) LIKE CONCAT('%', :keyword, '%')
                        )
                  ORDER BY
                        CASE WHEN u.role = 'MENTOR' THEN 0 ELSE 1 END,
                        u.last_active_at DESC,
                        u.created_at DESC
                  LIMIT :limit
                  """, nativeQuery = true)
      List<User> searchUsersForMessaging(@Param("keyword") String keyword, @Param("limit") int limit);

      /**
       * Suggested users when the search box is empty.
       */
      @Query(value = """
                  SELECT u.* FROM users u
                  WHERE u.enabled = true
                  ORDER BY
                        CASE WHEN u.role = 'MENTOR' THEN 0 ELSE 1 END,
                        u.last_active_at DESC,
                        u.created_at DESC
                  LIMIT :limit
                  """, nativeQuery = true)
      List<User> findSuggestedForMessaging(@Param("limit") int limit);

      /**
       * Backend-driven mentor search with keyword matching, price / rating /
       * experience filters, "online now" and "saved by learner" scopes, and a
       * server-side {@code sort} switch. Every filter is optional: pass
       * {@code null} (or 0) to disable it. Sorting is resolved entirely in SQL so
       * the frontend never re-orders results.
       *
       * <p>
       * Supported {@code sort} values: {@code rating}, {@code experience},
       * {@code price}, {@code availability}, {@code newest}. Any other value
       * (including {@code recent}) falls back to most-recently-active first.
       */
      @Query(value = """
                  SELECT DISTINCT u.* FROM users u
                  WHERE u.role = 'MENTOR'
                    AND u.enabled = true
                    AND (
                          :keyword IS NULL OR :keyword = ''
                          OR MATCH(u.full_name, u.about_me, u.skills, u.company, u.headline)
                               AGAINST (:keyword IN BOOLEAN MODE)
                          OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', :likeKeyword, '%')) ESCAPE '\\'
                          OR LOWER(u.email) LIKE LOWER(CONCAT('%', :likeKeyword, '%')) ESCAPE '\\'
                          OR LOWER(u.skills) LIKE LOWER(CONCAT('%', :likeKeyword, '%')) ESCAPE '\\'
                          OR LOWER(u.about_me) LIKE LOWER(CONCAT('%', :likeKeyword, '%')) ESCAPE '\\'
                          OR LOWER(u.company) LIKE LOWER(CONCAT('%', :likeKeyword, '%')) ESCAPE '\\'
                          OR LOWER(u.headline) LIKE LOWER(CONCAT('%', :likeKeyword, '%')) ESCAPE '\\'
                    )
                    AND (
                          :minPrice IS NULL
                          OR EXISTS (
                                  SELECT 1 FROM sessions s
                                  WHERE s.mentor_id = u.id
                                    AND s.price_amount >= :minPrice
                                    AND s.status IN ('PENDING', 'ACCEPTED')
                          )
                    )
                    AND (
                          :maxPrice IS NULL
                          OR EXISTS (
                                  SELECT 1 FROM sessions s
                                  WHERE s.mentor_id = u.id
                                    AND s.price_amount <= :maxPrice
                                    AND s.status IN ('PENDING', 'ACCEPTED')
                          )
                    )
                    AND (
                          :minRating IS NULL OR :minRating = 0
                          OR (
                                  SELECT COALESCE(AVG(r.rating), 0)
                                  FROM mentor_reviews r
                                  WHERE r.mentor_id = u.id
                          ) >= :minRating
                    )
                    AND (
                          :minExperience IS NULL OR :minExperience = 0
                          OR COALESCE(u.years_of_experience, 0) >= :minExperience
                    )
                    AND (
                          :onlineCutoff IS NULL
                          OR u.last_active_at >= :onlineCutoff
                    )
                    AND (
                          :savedLearnerId IS NULL
                          OR EXISTS (
                                  SELECT 1 FROM saved_mentors sm
                                  WHERE sm.mentor_id = u.id
                                    AND sm.learner_id = :savedLearnerId
                          )
                    )
                  ORDER BY
                    CASE WHEN :sort = 'rating' THEN (
                          SELECT COALESCE(AVG(r.rating), 0)
                          FROM mentor_reviews r WHERE r.mentor_id = u.id
                    ) END DESC,
                    CASE WHEN :sort = 'experience' THEN COALESCE(u.years_of_experience, 0) END DESC,
                    CASE WHEN :sort = 'price' THEN (
                          SELECT COALESCE(MIN(s.price_amount), 999999)
                          FROM sessions s
                          WHERE s.mentor_id = u.id
                            AND s.status IN ('PENDING', 'ACCEPTED')
                    ) END ASC,
                    CASE WHEN :sort = 'newest' THEN u.created_at END DESC,
                    CASE
                          WHEN :keyword IS NOT NULL AND :keyword != ''
                          THEN MATCH(u.full_name, u.about_me, u.skills, u.company, u.headline)
                                  AGAINST (:keyword IN BOOLEAN MODE)
                          ELSE NULL
                    END DESC,
                    u.last_active_at DESC
                  LIMIT :pageSize OFFSET :offset
                  """, nativeQuery = true)
      List<User> searchMentorsAdvanced(
                  @Param("keyword") String keyword,
                  @Param("likeKeyword") String likeKeyword,
                  @Param("minPrice") BigDecimal minPrice,
                  @Param("maxPrice") BigDecimal maxPrice,
                  @Param("minRating") Double minRating,
                  @Param("minExperience") Integer minExperience,
                  @Param("onlineCutoff") OffsetDateTime onlineCutoff,
                  @Param("savedLearnerId") Long savedLearnerId,
                  @Param("sort") String sort,
                  @Param("pageSize") int pageSize,
                  @Param("offset") int offset);
}
