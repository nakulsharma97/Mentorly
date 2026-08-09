package com.skillswap.auth;

import com.skillswap.common.SchedulerLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Scheduled cleanup for stale LoginAttempt records.
 * Prevents the login_attempts table from growing unbounded.
 */
/**
 * Service implementing login attempt cleanup business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoginAttemptCleanupService {

    private final LoginAttemptRepository loginAttemptRepository;
    private final SchedulerLockService schedulerLockService;

    /**
     * Purge expired login attempts (based on expiresAt field) and
     * attempts older than 7 days (legacy fallback).
     * Runs daily at 3:00 AM.
     */
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void purgeOldAttempts() {
        // Leader lock so only one instance (k8s replica) performs the purge.
        schedulerLockService.runIfLeader("auth-login-attempt-cleanup", () -> {
            OffsetDateTime now = OffsetDateTime.now();

            // Purge by explicit expiry (new TTL-based records)
            long expiredCount = loginAttemptRepository.deleteExpired(now);

            // Legacy fallback: purge records older than 7 days (backward compat)
            OffsetDateTime oldCutoff = now.minusDays(7);
            loginAttemptRepository.deleteOlderThan(oldCutoff);

            log.info("Purged {} expired login attempts + old records before {}", expiredCount, oldCutoff);
        });
    }
}
