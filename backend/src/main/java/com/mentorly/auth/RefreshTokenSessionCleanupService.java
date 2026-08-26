package com.mentorly.auth;

import com.mentorly.common.SchedulerLockService;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Service implementing refresh token session cleanup business logic.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenSessionCleanupService {

    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final AccessTokenDenylistRepository accessTokenDenylistRepository;
    private final MeterRegistry meterRegistry;
    private final SchedulerLockService schedulerLockService;

    @Transactional
    @Scheduled(cron = "${app.auth.refresh-token.cleanup-cron:0 20 3 * * *}", zone = "UTC")
    public void purgeExpiredOrRevokedSessions() {
        // Leader lock so only one instance (k8s replica) performs the nightly purge.
        schedulerLockService.runIfLeader("auth-refresh-token-cleanup", () -> {
            OffsetDateTime cutoff = OffsetDateTime.now(ZoneOffset.UTC);
            int deletedSessions = refreshTokenSessionRepository.deleteExpiredOrRevokedSessions(cutoff);
            int deletedDenylistEntries = accessTokenDenylistRepository.deleteExpiredEntries(cutoff);
            incrementCounter("auth.refresh.cleanup", "deleted", String.valueOf(deletedSessions));
            incrementCounter("auth.access_denylist.cleanup", "deleted", String.valueOf(deletedDenylistEntries));
        });
    }

    private void incrementCounter(String name, String... tags) {
        try {
            meterRegistry.counter(name, tags).increment();
        } catch (RuntimeException ignored) {
            // Metrics stay non-blocking in tests and local dev.
        }
    }
}
