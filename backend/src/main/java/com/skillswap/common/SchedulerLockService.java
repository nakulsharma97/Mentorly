package com.skillswap.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single-runner guard for {@code @Scheduled} jobs when the application runs
 * with multiple instances (e.g. k8s replicas). Uses MySQL's named advisory
 * locks ({@code GET_LOCK}/{@code RELEASE_LOCK}) so exactly one pod executes a
 * job per cycle — no Redis or external dependency required.
 *
 * <p>The lock is scoped to the surrounding JDBC connection, which means it is
 * released automatically if this process crashes (connection close) or when
 * the transaction ends (MySQL &ge; 5.7.5 releases advisory locks at commit /
 * rollback). A wedged job can therefore never block the cluster permanently.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulerLockService {

    /** MySQL advisory lock names are limited to 64 characters. */
    private static final int MAX_LOCK_NAME_LENGTH = 64;

    private final JdbcTemplate jdbcTemplate;

    /**
     * Runs {@code task} only on the instance that wins the named advisory
     * lock. Non-leader instances return immediately without running the task.
     *
     * @param lockName unique identifier for the job (max 64 chars)
     * @param task     the job to run on the leader instance
     * @return {@code true} if this instance acquired the lock and ran the task,
     *         {@code false} if another instance holds the lock
     */
    @Transactional
    public boolean runIfLeader(String lockName, Runnable task) {
        String safeName = sanitize(lockName);
        Integer acquired = jdbcTemplate.execute((ConnectionCallback<Integer>) con -> {
            try (var stmt = con.createStatement();
                    var rs = stmt.executeQuery("SELECT GET_LOCK('" + safeName + "', 0)")) {
                rs.next();
                return rs.getInt(1);
            }
        });
        if (!Integer.valueOf(1).equals(acquired)) {
            return false;
        }
        // The lock is intentionally NOT released here. Since MySQL 5.7.5
        // advisory locks are transaction-scoped: they are released when the
        // surrounding @Transactional commit/rollback completes. Releasing it
        // before the commit would let another instance acquire the lock and
        // start the job while this transaction's writes are still invisible,
        // duplicating the work. The lock also auto-releases if this process
        // crashes (connection close), so a failed leader can never wedge it.
        task.run();
        return true;
    }

    private static String sanitize(String lockName) {
        if (lockName == null || lockName.isBlank() || lockName.length() > MAX_LOCK_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "Lock name must be 1-" + MAX_LOCK_NAME_LENGTH + " characters");
        }
        return lockName.replace("'", "''");
    }
}
