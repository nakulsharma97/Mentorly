package com.skillswap.auth;

import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenSessionCleanupServiceTest {

    @Mock
    private RefreshTokenSessionRepository refreshTokenSessionRepository;

    @Mock
    private AccessTokenDenylistRepository accessTokenDenylistRepository;

    @Mock
    private MeterRegistry meterRegistry;

    @InjectMocks
    private RefreshTokenSessionCleanupService cleanupService;

    @Test
    void purgeExpiredOrRevokedSessionsDeletesStaleRows() {
        when(refreshTokenSessionRepository.deleteExpiredOrRevokedSessions(any(OffsetDateTime.class))).thenReturn(3);
        when(accessTokenDenylistRepository.deleteExpiredEntries(any(OffsetDateTime.class))).thenReturn(2);

        cleanupService.purgeExpiredOrRevokedSessions();

        verify(refreshTokenSessionRepository).deleteExpiredOrRevokedSessions(any(OffsetDateTime.class));
        verify(accessTokenDenylistRepository).deleteExpiredEntries(any(OffsetDateTime.class));
        verify(meterRegistry).counter("auth.refresh.cleanup", "deleted", "3");
        verify(meterRegistry).counter("auth.access_denylist.cleanup", "deleted", "2");
    }
}
