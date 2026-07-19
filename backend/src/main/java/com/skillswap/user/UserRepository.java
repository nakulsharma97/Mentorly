package com.skillswap.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT u FROM User u WHERE u.id = :userId")
        Optional<User> findByIdWithLock(@Param("userId") Long userId);

        Optional<User> findByEmail(String email);

        Optional<User> findByReferralCodeIgnoreCase(String referralCode);

        Optional<User> findByPasswordResetToken(String passwordResetToken);

        boolean existsByEmail(String email);

        boolean existsByReferralCodeIgnoreCase(String referralCode);

        long countByReferredByUserId(Long referredByUserId);

        long countByRole(UserRole role);

        long countByReferralCodeIsNotNull();

        List<User> findByRole(UserRole role);

        Page<User> findByRole(UserRole role, Pageable pageable);

        List<User> findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole role);

        List<User> findByRoleAndEnabledTrueAndSkillsContainingIgnoreCaseOrderByLastActiveAtDesc(UserRole role,
                        String skill);

        List<User> findByRoleAndEnabledTrueAndLastActiveAtAfterOrderByLastActiveAtDesc(UserRole role,
                        OffsetDateTime cutoff);

        long countByLastActiveAtAfter(OffsetDateTime cutoff);

        long countByCreatedAtAfter(OffsetDateTime cutoff);

        // ── Admin pagination queries ──
        @Query("SELECT u FROM User u WHERE "
                + "(:role IS NULL OR u.role = :role) "
                + "AND (:q IS NULL OR :q = '' "
                + "OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')) "
                + "OR LOWER(u.email) LIKE LOWER(CONCAT('%', COALESCE(:q, ''), '%')))")
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
         * <p>Supported {@code sort} values: {@code rating}, {@code experience},
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
                                OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(u.skills) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(u.about_me) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(u.company) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(u.headline) LIKE LOWER(CONCAT('%', :keyword, '%'))
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
