package com.mentorly.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the MySQL advisory-lock based leader election used by
 * scheduled jobs.
 */
@ExtendWith(MockitoExtension.class)
class SchedulerLockServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private SchedulerLockService schedulerLockService;

    @BeforeEach
    void setUp() {
        schedulerLockService = new SchedulerLockService(jdbcTemplate);
    }

    @Test
    void runIfLeaderRunsTaskWhenLockAcquired() {
        when(jdbcTemplate.execute(any(ConnectionCallback.class))).thenReturn(1);

        Runnable task = mock(Runnable.class);
        boolean ran = schedulerLockService.runIfLeader("booking-lifecycle-promote", task);

        assertTrue(ran);
        verify(task).run();
    }

    @Test
    void runIfLeaderSkipsTaskWhenAnotherInstanceHoldsLock() {
        when(jdbcTemplate.execute(any(ConnectionCallback.class))).thenReturn(0);

        Runnable task = mock(Runnable.class);
        boolean ran = schedulerLockService.runIfLeader("booking-lifecycle-promote", task);

        assertFalse(ran);
        verify(task, never()).run();
        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void runIfLeaderDoesNotExplicitlyReleaseLock() {
        when(jdbcTemplate.execute(any(ConnectionCallback.class))).thenReturn(1);

        Runnable task = mock(Runnable.class);
        boolean ran = schedulerLockService.runIfLeader("notification-broadcast-poll", task);

        assertTrue(ran);
        verify(task).run();
        // The lock must not be released before the transaction commits: it is
        // transaction-scoped (released at commit/rollback) so a peer instance
        // cannot start the job while this transaction's writes are invisible.
        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void runIfLeaderRejectsInvalidLockName() {
        assertThrows(IllegalArgumentException.class,
                () -> schedulerLockService.runIfLeader(null, () -> { }));
        assertThrows(IllegalArgumentException.class,
                () -> schedulerLockService.runIfLeader("", () -> { }));
        assertThrows(IllegalArgumentException.class,
                () -> schedulerLockService.runIfLeader("x".repeat(65), () -> { }));
    }
}
