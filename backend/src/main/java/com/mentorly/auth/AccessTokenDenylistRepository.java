package com.mentorly.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Spring Data repository for {@code AccessTokenDenylist} persistence.
 */
public interface AccessTokenDenylistRepository extends JpaRepository<AccessTokenDenylist, Long> {

    Optional<AccessTokenDenylist> findByJti(String jti);

    boolean existsByJtiAndExpiresAtAfter(String jti, OffsetDateTime cutoff);

    @Modifying
    @Query("delete from AccessTokenDenylist token where token.expiresAt < :cutoff")
    int deleteExpiredEntries(@Param("cutoff") OffsetDateTime cutoff);
}
