package com.skillswap.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;

/**
 * Development-only seeder that re-creates the demo/test accounts and sample
 * data (previously seeded by Flyway migrations {@code V9} and {@code V39})
 * on local development databases.
 * <p>
 * Production seeding was removed by {@code V50__purge_seeded_demo_data.sql};
 * this component exists so the local dev experience (test accounts, demo
 * mentors/learners, sample bookings and reviews used by the UI and e2e
 * scripts) is unchanged.
 * <p>
 * Safety properties:
 * <ul>
 *   <li>Active ONLY for the {@code dev} and {@code local} Spring profiles —
 *       production/staging never run it.</li>
 *   <li>Idempotent: it is a no-op when any demo account already exists, so it
 *       never duplicates data and never touches records a developer created
 *       on top of the demo accounts.</li>
 *   <li>Failures are logged, never fatal — a seeding problem must not block
 *       application startup.</li>
 * </ul>
 */
@Component
@Profile({"dev", "local"})
@Slf4j
public class DevDataSeeder implements CommandLineRunner {

    /** Demo/test accounts created by the dev-seed scripts (the set V50 purges). */
    static final List<String> DEMO_EMAILS = List.of(
            "mentor@test.com",
            "learner@test.com",
            "priya.sharma@example.com",
            "raj.patel@example.com",
            "sarah.chen@example.com",
            "amit.kumar@example.com",
            "emma.wilson@example.com",
            "alex.johnson@example.com",
            "maria.garcia@example.com");

    /** Classpath scripts, executed in order. Mirrors the original V9 then V39. */
    private static final List<String> SEED_SCRIPTS = List.of(
            "db/dev-seed/dev-test-users.sql",
            "db/dev-seed/dev-sample-data.sql");

    private final DataSource dataSource;

    public DevDataSeeder(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) {
        try (Connection connection = dataSource.getConnection()) {
            if (demoDataExists(connection)) {
                log.info("DevDataSeeder skipped — demo data already present (dev profile)");
                return;
            }
            for (String script : SEED_SCRIPTS) {
                ScriptUtils.executeSqlScript(connection, new ClassPathResource(script));
            }
            log.info("DevDataSeeder — seeded demo users and sample data (dev profile)");
        } catch (Exception ex) {
            log.warn("DevDataSeeder could not seed demo data (dev-only convenience, continuing): {}",
                    ex.getMessage());
        }
    }

    private boolean demoDataExists(Connection connection) throws java.sql.SQLException {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM users WHERE email IN (");
        sql.append("?, ".repeat(Math.max(0, DEMO_EMAILS.size() - 1)));
        sql.append("?)");
        try (var stmt = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < DEMO_EMAILS.size(); i++) {
                stmt.setString(i + 1, DEMO_EMAILS.get(i));
            }
            try (var rs = stmt.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }
}
