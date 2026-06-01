package com.skillswap.user;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
        Optional<User> findByEmail(String email);

        Optional<User> findByReferralCodeIgnoreCase(String referralCode);

        boolean existsByEmail(String email);

        boolean existsByReferralCodeIgnoreCase(String referralCode);

        long countByReferredByUserId(Long referredByUserId);

        List<User> findByRole(UserRole role);

        List<User> findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole role);

        List<User> findByRoleAndEnabledTrueAndSkillsContainingIgnoreCaseOrderByLastActiveAtDesc(UserRole role,
                        String skill);

        List<User> findByRoleAndEnabledTrueAndLastActiveAtAfterOrderByLastActiveAtDesc(UserRole role,
                        OffsetDateTime cutoff);

        @Query(value = """
                                                                                                SELECT DISTINCT u.* FROM users u
                        WHERE u.role = 'MENTOR'
                        AND u.enabled = true
                                                                                                AND (
                                                                                                        :keyword IS NULL OR :keyword = ''
                                                                                                        OR MATCH(u.full_name, u.about_me, u.skills)
                                                                                                                 AGAINST (:keyword IN BOOLEAN MODE)
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
                        ORDER BY
                                                                                                        CASE
                                                                                                                WHEN :keyword IS NULL OR :keyword = ''
                                                                                                                THEN u.last_active_at
                                                                                                                ELSE NULL
                                                                                                        END DESC,
                                                                                                        CASE
                                                                                                                WHEN :keyword IS NOT NULL AND :keyword != ''
                                                                                                                THEN MATCH(u.full_name, u.about_me, u.skills)
                                                                                                                                 AGAINST (:keyword IN BOOLEAN MODE)
                                                                                                                ELSE NULL
                          END,
                                                                                                        u.last_active_at DESC
                        LIMIT :pageSize OFFSET :offset
                        """, nativeQuery = true)
        List<User> searchMentorsFiltered(
                        @Param("keyword") String keyword,
                        @Param("minPrice") BigDecimal minPrice,
                        @Param("maxPrice") BigDecimal maxPrice,
                        @Param("minRating") Double minRating,
                        @Param("pageSize") int pageSize,
                        @Param("offset") int offset);
}
