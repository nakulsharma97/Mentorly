package com.mentorly.auth;

import com.mentorly.user.User;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Spring Data repository for {@code RefreshTokenSession} persistence.
 */
public interface RefreshTokenSessionRepository extends JpaRepository<RefreshTokenSession, Long> {

    Optional<RefreshTokenSession> findByTokenIdAndRevokedFalseAndExpiresAtAfter(String tokenId,
            OffsetDateTime cutoff);

    /**
     * Loads the active refresh session for a tokenId with a pessimistic write
     * lock ({@code SELECT ... FOR UPDATE}). Combined with the single-use
     * rotation in {@code AuthService.refreshToken}, concurrent refresh requests
     * for the same token serialize on this row: the first to commit revokes it,
     * so every subsequent request re-reads the committed row and finds it
     * already revoked — replaying a used refresh token is rejected.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RefreshTokenSession r where r.tokenId = :tokenId "
            + "and r.revoked = false and r.expiresAt > :cutoff")
    Optional<RefreshTokenSession> findActiveByTokenIdForUpdate(@Param("tokenId") String tokenId,
            @Param("cutoff") OffsetDateTime cutoff);

    long countByUserAndRevokedFalse(User user);

    /**
     * True if a session row exists for the tokenId regardless of revoked/expired
     * state. Used by {@code AuthService.refreshToken} to distinguish "token was
     * rotated and is being replayed" (reuse → revoke whole session family) from
     * "token never existed" (generic invalid-token error).
     */
    boolean existsByTokenId(String tokenId);

    @Modifying
    @Query("update RefreshTokenSession s set s.revoked = true where s.user = :user and s.revoked = false")
    int revokeAllByUserAndRevokedFalse(@Param("user") User user);

    @Modifying
    @Query("update RefreshTokenSession s set s.revoked = true where s.tokenId = :tokenId and s.revoked = false")
    int revokeByTokenIdAndRevokedFalse(@Param("tokenId") String tokenId);

    @Modifying
    @Query("delete from RefreshTokenSession s where s.revoked = true or s.expiresAt < :cutoff")
    int deleteExpiredOrRevokedSessions(@Param("cutoff") OffsetDateTime cutoff);
}
