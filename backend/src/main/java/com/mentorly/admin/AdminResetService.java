package com.mentorly.admin;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Service that resets the application to a fresh state by deleting all
 * user-generated data while preserving the database schema and system
 * configuration (admin_settings, admin_notif_preferences, skills).
 */
@Service
public class AdminResetService {

    private static final Logger LOG = LoggerFactory.getLogger(AdminResetService.class);

    /**
     * Tables to clear, ordered for readability. Execution order does not matter
     * because FOREIGN_KEY_CHECKS is disabled during the entire operation — every
     * table is deleted before re-enabling constraints.
     */
    private static final String[] ALL_TABLES_IN_DELETION_ORDER = {
            // Step 1: Auth & token tables (no FK to users)
            "access_token_denylist",
            "login_attempts",
            "refresh_token_sessions",

            // Step 2: Learning roadmaps (FK to bookings)
            "learning_roadmaps",

            // Step 4: Skill verification submissions (FK to tasks, users)
            "skill_verification_submissions",
            "skill_verification_tasks",

            // Step 5: Session waitlist (FK to sessions, users)
            "session_waitlist",

            // Step 6: Booking idempotency keys (FK to bookings, users)
            "booking_idempotency_keys",

            // Step 7: Payment idempotency keys (FK to payments, users)
            "payment_idempotency_keys",

            // Step 8: Payments (FK to sessions, users)
            "payments",

            // Step 9: Bookings (FK to sessions, users)
            "bookings",

            // Step 10: Reviews (FK to bookings, users)
            "learner_reviews",
            "mentor_reviews",

            // Step 11: Chat messages (FK to bookings, users)
            "chat_messages",

            // Step 12: User certifications (FK to users, bookings)
            "user_certifications",

            // Step 13: Direct messages & conversations, message requests (FK to users)
            "direct_messages",
            "direct_conversations",
            "message_requests",

            // Step 14: Mentor certifications (FK to users)
            "mentor_certifications",

            // Step 15: Session packages (FK to users)
            "session_packages",

            // Step 16: Session requests (FK to users)
            "session_requests",

            // Step 17: Sessions (FK to users)
            "sessions",

            // Step 18: Mentor verification requests (FK to users)
            "mentor_verification_requests",

            // Step 19: Mentor wallets (FK to users)
            "mentor_wallets",

            // Step 20: Wallet ledger entries (FK to users)
            "wallet_ledger_entries",

            // Step 21: Notification preferences (FK to users)
            "notification_preferences",

            // Step 22: App notifications (FK to users)
            "app_notifications",

            // Step 23: User projects (FK to users)
            "user_projects",

            // Step 24: User availability slots (FK to users)
            "user_availability_slots",

            // Step 25: Saved mentors (FK to users)
            "saved_mentors",

            // Step 26: Skill watchlist (FK to users)
            "skill_watchlist",

            // Step 27: User reports (FK to users)
            "user_reports",

            // Step 28: User blocks (FK to users)
            "user_blocks",

            // Step 29: Audit logs (FK to users)
            "audit_logs",

            // Step 30: Users (parent table - delete everything)
            "users",

            // NOTE: The following tables are PRESERVED (system data):
            //   - skills (system-defined skill categories)
            //   - admin_settings (system configuration)
            //   - admin_notif_preferences (notification preferences)
    };

    private static final String[] UPLOAD_SUBDIRS = {"chat", "certificates"};

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Deletes all user-generated data from the database and clears uploaded files.
     * This operation is irreversible.
     *
     * @return a summary of the cleanup operation
     */
    @Transactional
    public CleanupResult resetAllData() {
        int totalDeleted = 0;

        // Disable foreign key checks to allow TRUNCATE in any order
        entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();

        try {
            for (String table : ALL_TABLES_IN_DELETION_ORDER) {
                int deleted = entityManager
                        .createNativeQuery("DELETE FROM " + table)
                        .executeUpdate();
                totalDeleted += deleted;

                // Reset auto-increment
                entityManager
                        .createNativeQuery("ALTER TABLE " + table + " AUTO_INCREMENT = 1")
                        .executeUpdate();

                LOG.info("Cleared table {} ({} rows deleted)", table, deleted);
            }
        } finally {
            // Re-enable foreign key checks
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
        }

        int cleanedFiles = clearUploadedFiles();

        LOG.warn("Database reset complete: {} rows deleted from {} tables, {} uploaded files removed",
                totalDeleted, ALL_TABLES_IN_DELETION_ORDER.length, cleanedFiles);

        return new CleanupResult(totalDeleted, ALL_TABLES_IN_DELETION_ORDER.length, cleanedFiles);
    }

    /**
     * Deletes all uploaded files from the uploads directory.
     */
    private int clearUploadedFiles() {
        int cleaned = 0;
        for (String subdir : UPLOAD_SUBDIRS) {
            Path dir = Paths.get("uploads", subdir);
            if (Files.isDirectory(dir)) {
                try (var files = Files.list(dir)) {
                    for (Path file : files.toList()) {
                        try {
                            Files.deleteIfExists(file);
                            cleaned++;
                            LOG.info("Deleted uploaded file: {}", file);
                        } catch (IOException e) {
                            LOG.warn("Failed to delete uploaded file: {}", file, e);
                        }
                    }
                    // Remove the now-empty subdirectory
                    try {
                        Files.deleteIfExists(dir);
                    } catch (IOException e) {
                        LOG.warn("Failed to delete empty upload directory: {}", dir, e);
                    }
                } catch (IOException e) {
                    LOG.warn("Failed to list upload directory: {}", dir, e);
                }
            }
        }
        return cleaned;
    }

    /**
     * Result of the cleanup operation.
     */
    public record CleanupResult(int rowsDeleted, int tablesCleared, int uploadedFilesRemoved) {
        public String summary() {
            return String.format(
                    "Deleted %d rows from %d tables and removed %d uploaded files.",
                    rowsDeleted, tablesCleared, uploadedFilesRemoved);
        }
    }
}
