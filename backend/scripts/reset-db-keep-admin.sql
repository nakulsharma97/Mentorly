-- ═══════════════════════════════════════════════════════════════════════════
--  Skill Swap — Reset to Clean Testing State (keep Admin only)
--
--  Deletes ALL user-generated data while preserving:
--    ✓ The admin account (id = 1) — login, role and password untouched
--    ✓ Database schema (tables, indexes, constraints, triggers)
--    ✓ admin_settings (system configuration)
--    ✓ admin_notif_preferences (admin notification preferences)
--    ✓ skills (system-defined skill master list)
--    ✓ flyway_schema_history (migration bookkeeping)
--    ✓ Application configuration & source code (never touched)
--
--  Usage:
--    mysql -u root -p skill < reset-db-keep-admin.sql
-- ═══════════════════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

-- ── Auth / token / session tables ──
TRUNCATE TABLE access_token_denylist;
TRUNCATE TABLE login_attempts;
TRUNCATE TABLE refresh_token_sessions;

-- ── Referral & rewards ──
TRUNCATE TABLE referral_rewards;

-- ── Learning & progress ──
TRUNCATE TABLE learning_roadmaps;

-- ── Skill verification ──
TRUNCATE TABLE skill_verification_submissions;
TRUNCATE TABLE skill_verification_tasks;
TRUNCATE TABLE skill_requests;

-- ── Bookings / payments / waitlist / idempotency ──
TRUNCATE TABLE session_waitlist;
TRUNCATE TABLE booking_idempotency_keys;
TRUNCATE TABLE payment_idempotency_keys;
TRUNCATE TABLE payments;
TRUNCATE TABLE bookings;

-- ── Reviews / feedback ──
TRUNCATE TABLE learner_reviews;
TRUNCATE TABLE mentor_reviews;

-- ── Messaging ──
TRUNCATE TABLE chat_messages;
TRUNCATE TABLE direct_messages;
TRUNCATE TABLE direct_conversations;
TRUNCATE TABLE message_requests;

-- ── Certifications ──
TRUNCATE TABLE user_certifications;
TRUNCATE TABLE mentor_certifications;

-- ── Sessions / requests / packages ──
TRUNCATE TABLE session_packages;
TRUNCATE TABLE session_requests;
TRUNCATE TABLE sessions;

-- ── Mentor verification ──
TRUNCATE TABLE mentor_verification_requests;

-- ── Wallets / earnings ──
TRUNCATE TABLE mentor_wallets;
TRUNCATE TABLE wallet_ledger_entries;

-- ── Notifications ──
TRUNCATE TABLE notification_preferences;
TRUNCATE TABLE app_notifications;
TRUNCATE TABLE notification_broadcasts;

-- ── Profile / engagement / trust & safety ──
TRUNCATE TABLE user_projects;
TRUNCATE TABLE user_availability_slots;
TRUNCATE TABLE saved_mentors;
TRUNCATE TABLE skill_watchlist;
TRUNCATE TABLE user_reports;
TRUNCATE TABLE user_blocks;
TRUNCATE TABLE flagged_content;
TRUNCATE TABLE flagged_content_events;

-- ── Uploaded files / documents ──
TRUNCATE TABLE stored_files;

-- ── Audit / activity logs ──
TRUNCATE TABLE audit_logs;

-- ── Users — DELETE every account EXCEPT the admin (id = 1) ──
DELETE FROM users WHERE id <> 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Reset auto-increment counters (data tables only; master tables untouched) ──
ALTER TABLE access_token_denylist          AUTO_INCREMENT = 1;
ALTER TABLE login_attempts                 AUTO_INCREMENT = 1;
ALTER TABLE refresh_token_sessions         AUTO_INCREMENT = 1;
ALTER TABLE referral_rewards               AUTO_INCREMENT = 1;
ALTER TABLE learning_roadmaps              AUTO_INCREMENT = 1;
ALTER TABLE skill_verification_submissions AUTO_INCREMENT = 1;
ALTER TABLE skill_verification_tasks       AUTO_INCREMENT = 1;
ALTER TABLE skill_requests                 AUTO_INCREMENT = 1;
ALTER TABLE session_waitlist               AUTO_INCREMENT = 1;
ALTER TABLE booking_idempotency_keys       AUTO_INCREMENT = 1;
ALTER TABLE payment_idempotency_keys       AUTO_INCREMENT = 1;
ALTER TABLE payments                       AUTO_INCREMENT = 1;
ALTER TABLE bookings                       AUTO_INCREMENT = 1;
ALTER TABLE learner_reviews                AUTO_INCREMENT = 1;
ALTER TABLE mentor_reviews                 AUTO_INCREMENT = 1;
ALTER TABLE chat_messages                  AUTO_INCREMENT = 1;
ALTER TABLE direct_messages                AUTO_INCREMENT = 1;
ALTER TABLE direct_conversations           AUTO_INCREMENT = 1;
ALTER TABLE message_requests               AUTO_INCREMENT = 1;
ALTER TABLE user_certifications            AUTO_INCREMENT = 1;
ALTER TABLE mentor_certifications          AUTO_INCREMENT = 1;
ALTER TABLE session_packages               AUTO_INCREMENT = 1;
ALTER TABLE session_requests               AUTO_INCREMENT = 1;
ALTER TABLE sessions                       AUTO_INCREMENT = 1;
ALTER TABLE mentor_verification_requests   AUTO_INCREMENT = 1;
ALTER TABLE mentor_wallets                 AUTO_INCREMENT = 1;
ALTER TABLE wallet_ledger_entries          AUTO_INCREMENT = 1;
ALTER TABLE notification_preferences       AUTO_INCREMENT = 1;
ALTER TABLE app_notifications              AUTO_INCREMENT = 1;
ALTER TABLE notification_broadcasts        AUTO_INCREMENT = 1;
ALTER TABLE user_projects                  AUTO_INCREMENT = 1;
ALTER TABLE user_availability_slots        AUTO_INCREMENT = 1;
ALTER TABLE saved_mentors                  AUTO_INCREMENT = 1;
ALTER TABLE skill_watchlist                AUTO_INCREMENT = 1;
ALTER TABLE user_reports                   AUTO_INCREMENT = 1;
ALTER TABLE user_blocks                    AUTO_INCREMENT = 1;
ALTER TABLE flagged_content                AUTO_INCREMENT = 1;
ALTER TABLE flagged_content_events         AUTO_INCREMENT = 1;
ALTER TABLE stored_files                   AUTO_INCREMENT = 1;
ALTER TABLE audit_logs                     AUTO_INCREMENT = 1;
-- Next created user starts at id 2 (admin keeps id 1).
ALTER TABLE users                          AUTO_INCREMENT = 2;

-- ═══════════════════════════════════════════════════════════════════════════
--  Verification queries
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'Admin preserved' AS check_name,
       COUNT(*) AS value
FROM users
WHERE id = 1 AND role = 'ADMIN' AND enabled = TRUE;

SELECT 'Non-admin users remaining' AS check_name,
       COUNT(*) AS value
FROM users
WHERE id <> 1;

SELECT 'users table total' AS check_name,
       COUNT(*) AS value
FROM users;

SELECT 'Next user id (auto_increment)' AS check_name,
       AUTO_INCREMENT AS value
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = 'users';
