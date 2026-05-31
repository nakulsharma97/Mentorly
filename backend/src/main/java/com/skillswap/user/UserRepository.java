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
                        SELECT u.* FROM users u
                        WHERE u.role = 'MENTOR'
                        AND u.enabled = true
                        AND (:keyword IS NULL OR :keyword = ''
                                 OR MATCH(u.full_name, u.about_me, u.skills) AGAINST (:keyword IN BOOLEAN MODE))
                        AND (:minPrice IS NULL OR EXISTS (
                                SELECT 1 FROM sessions s WHERE s.mentor_id = u.id AND s.price_amount >= :minPrice
                        ))
                        AND (:maxPrice IS NULL OR EXISTS (
                                SELECT 1 FROM sessions s WHERE s.mentor_id = u.id AND s.price_amount <= :maxPrice
                        ))
                        AND (:availabilityDay IS NULL OR :availabilityDay = '' OR EXISTS (
                                SELECT 1
                                FROM user_availability_slots a
                                WHERE a.user_id = u.id
                                  AND a.day_of_week = CASE UPPER(:availabilityDay)
                                          WHEN 'MONDAY' THEN 1
                                          WHEN 'TUESDAY' THEN 2
                                          WHEN 'WEDNESDAY' THEN 3
                                          WHEN 'THURSDAY' THEN 4
                                          WHEN 'FRIDAY' THEN 5
                                          WHEN 'SATURDAY' THEN 6
                                          WHEN 'SUNDAY' THEN 7
                                          ELSE -1
                                  END
                                  AND a.active = true
                        ))
                        ORDER BY
                          CASE WHEN :keyword IS NULL OR :keyword = '' THEN 0
                                   ELSE -MATCH(u.full_name, u.about_me, u.skills) AGAINST (:keyword IN BOOLEAN MODE)
                          END,
                          u.last_active_at DESC
                        LIMIT :pageSize OFFSET :offset
                        """, nativeQuery = true)
        List<User> searchMentors(
                        @Param("keyword") String keyword,
                        @Param("minPrice") BigDecimal minPrice,
                        @Param("maxPrice") BigDecimal maxPrice,
                        @Param("availabilityDay") String availabilityDay,
                        @Param("pageSize") int pageSize,
                        @Param("offset") int offset);
}
