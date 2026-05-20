package com.skillswap.auth;

import com.skillswap.user.User;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface RefreshTokenSessionRepository extends JpaRepository<RefreshTokenSession, Long> {

    Optional<RefreshTokenSession> findByTokenIdAndRevokedFalse(String tokenId);

    long countByUserAndRevokedFalse(User user);

    @Modifying
    @Query("update RefreshTokenSession s set s.revoked = true where s.user = :user and s.revoked = false")
    int revokeAllByUserAndRevokedFalse(@Param("user") User user);

    @Modifying
    @Query("delete from RefreshTokenSession s where s.revoked = true or s.expiresAt < :cutoff")
    int deleteExpiredOrRevokedSessions(@Param("cutoff") OffsetDateTime cutoff);
}
