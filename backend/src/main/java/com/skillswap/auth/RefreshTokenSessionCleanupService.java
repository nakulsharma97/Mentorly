package com.skillswap.auth;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class RefreshTokenSessionCleanupService {

    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final MeterRegistry meterRegistry;

    @Transactional
    @Scheduled(cron = "${app.auth.refresh-token.cleanup-cron:0 20 3 * * *}", zone = "UTC")
    public void purgeExpiredOrRevokedSessions() {
        int deletedSessions = refreshTokenSessionRepository.deleteExpiredOrRevokedSessions(
                OffsetDateTime.now(ZoneOffset.UTC));
        incrementCounter("auth.refresh.cleanup", "deleted", String.valueOf(deletedSessions));
    }

    private void incrementCounter(String name, String... tags) {
        try {
            meterRegistry.counter(name, tags).increment();
        } catch (RuntimeException ignored) {
            // Metrics stay non-blocking in tests and local dev.
        }
    }
}
