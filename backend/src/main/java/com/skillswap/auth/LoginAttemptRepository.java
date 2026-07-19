package com.skillswap.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    Optional<LoginAttempt> findByIpAddress(String ipAddress);

    long countByIpAddressAndLastAttemptAtAfter(String ipAddress, OffsetDateTime after);

    @Modifying
    @Query("DELETE FROM LoginAttempt la WHERE la.expiresAt IS NOT NULL AND la.expiresAt < :cutoff")
    int deleteExpired(@Param("cutoff") OffsetDateTime cutoff);

    @Modifying
    @Query("DELETE FROM LoginAttempt la WHERE la.lastAttemptAt < :cutoff")
    void deleteOlderThan(@Param("cutoff") OffsetDateTime cutoff);
}
