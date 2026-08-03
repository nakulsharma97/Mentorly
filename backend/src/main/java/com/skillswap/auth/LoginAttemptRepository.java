package com.skillswap.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Spring Data repository for {@code LoginAttempt} persistence.
 */
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    /**
     * Finds the attempt counter for one IP and one auth flow. Each flow
     * (login / forgot-password) has its own row, so they never share quotas
     * or lockout state.
     */
    Optional<LoginAttempt> findByIpAddressAndAttemptType(String ipAddress, AttemptType attemptType);

    /** Row count for the IP in a window — used by the signup IP gate. */
    long countByIpAddressAndLastAttemptAtAfter(String ipAddress, OffsetDateTime after);

    /** Total failed-login records updated since a timestamp — feeds monitoring security metrics. */
    long countByLastAttemptAtAfter(OffsetDateTime after);

    /** Accounts/IPs currently locked out (blocked_until in the future) — feeds the retry queue. */
    long countByBlockedUntilAfter(OffsetDateTime after);

    @Modifying
    @Query("DELETE FROM LoginAttempt la WHERE la.expiresAt IS NOT NULL AND la.expiresAt < :cutoff")
    int deleteExpired(@Param("cutoff") OffsetDateTime cutoff);

    @Modifying
    @Query("DELETE FROM LoginAttempt la WHERE la.lastAttemptAt < :cutoff")
    void deleteOlderThan(@Param("cutoff") OffsetDateTime cutoff);
}
