-- ═════════════════════════════════════════════════════════════════════════════
--  Skill Swapper - Database Cleanup Script
--  Deletes ALL user-generated data while preserving:
--    ✓ Database schema (tables, indexes, constraints)
--    ✓ admin_settings table (system configuration)
--    ✓ admin_notif_preferences table (notification preferences)
--    ✓ skills table (system-defined skill categories)
--    ✓ Application configuration
--    ✓ Core functionality
-- ═════════════════════════════════════════════════════════════════════════════
--
--  Usage:
--    mysql -u root -p skill < cleanup-db.sql
--
--  Or from mysql CLI:
--    mysql> SOURCE cleanup-db.sql;
--
-- ═════════════════════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

-- ── Step 1: Auth & Token tables (no FK to users or minimal dependencies) ──
TRUNCATE TABLE access_token_denylist;
TRUNCATE TABLE login_attempts;
TRUNCATE TABLE refresh_token_sessions;

-- ── Step 2: Referral rewards (FK to users, bookings) ──
TRUNCATE TABLE referral_rewards;

-- ── Step 3: Learning roadmaps (FK to bookings) ──
TRUNCATE TABLE learning_roadmaps;

-- ── Step 4: Skill verification submissions (FK to tasks, users) ──
TRUNCATE TABLE skill_verification_submissions;
TRUNCATE TABLE skill_verification_tasks;

-- ── Step 5: Session waitlist (FK to sessions, users) ──
TRUNCATE TABLE session_waitlist;

-- ── Step 6: Booking idempotency keys (FK to bookings, users) ──
TRUNCATE TABLE booking_idempotency_keys;

-- ── Step 7: Payment idempotency keys (FK to payments, users) ──
TRUNCATE TABLE payment_idempotency_keys;

-- ── Step 8: Payments (FK to sessions, users) ──
TRUNCATE TABLE payments;

-- ── Step 9: Bookings (FK to sessions, users) ──
TRUNCATE TABLE bookings;

-- ── Step 10: Reviews (FK to bookings, users) ──
TRUNCATE TABLE learner_reviews;
TRUNCATE TABLE mentor_reviews;

-- ── Step 11: Chat messages (FK to bookings, users) ──
TRUNCATE TABLE chat_messages;

-- ── Step 12: User certifications (FK to users, bookings) ──
TRUNCATE TABLE user_certifications;

-- ── Step 13: Direct messages (FK to conversations, users) ──
TRUNCATE TABLE direct_messages;
TRUNCATE TABLE direct_conversations;
TRUNCATE TABLE message_requests;

-- ── Step 14: Mentor certifications (FK to users) ──
TRUNCATE TABLE mentor_certifications;

-- ── Step 15: Session packages (FK to users) ──
TRUNCATE TABLE session_packages;

-- ── Step 16: Session requests (FK to users) ──
TRUNCATE TABLE session_requests;

-- ── Step 17: Sessions (FK to users) ──
TRUNCATE TABLE sessions;

-- ── Step 18: Mentor verification requests (FK to users) ──
TRUNCATE TABLE mentor_verification_requests;

-- ── Step 19: Mentor wallets (FK to users) ──
TRUNCATE TABLE mentor_wallets;

-- ── Step 20: Wallet ledger entries (FK to users) ──
TRUNCATE TABLE wallet_ledger_entries;

-- ── Step 21: Notification preferences (FK to users) ──
TRUNCATE TABLE notification_preferences;

-- ── Step 22: App notifications (FK to users) ──
TRUNCATE TABLE app_notifications;

-- ── Step 23: User projects (FK to users) ──
TRUNCATE TABLE user_projects;

-- ── Step 24: User availability slots (FK to users) ──
TRUNCATE TABLE user_availability_slots;

-- ── Step 25: Saved mentors (FK to users) ──
TRUNCATE TABLE saved_mentors;

-- ── Step 26: Skill watchlist (FK to users) ──
TRUNCATE TABLE skill_watchlist;

-- ── Step 27: User reports (FK to users) ──
TRUNCATE TABLE user_reports;

-- ── Step 28: User blocks (FK to users) ──
TRUNCATE TABLE user_blocks;

-- ── Step 29: Audit logs (FK to users) ──
TRUNCATE TABLE audit_logs;

-- ── Step 30: Users (parent table - delete everything) ──
TRUNCATE TABLE users;

-- ── Step 31: Reset auto-increment counters for all tables ──
ALTER TABLE access_token_denylist        AUTO_INCREMENT = 1;
ALTER TABLE login_attempts               AUTO_INCREMENT = 1;
ALTER TABLE refresh_token_sessions       AUTO_INCREMENT = 1;
ALTER TABLE referral_rewards             AUTO_INCREMENT = 1;
ALTER TABLE learning_roadmaps            AUTO_INCREMENT = 1;
ALTER TABLE skill_verification_submissions AUTO_INCREMENT = 1;
ALTER TABLE skill_verification_tasks     AUTO_INCREMENT = 1;
ALTER TABLE session_waitlist             AUTO_INCREMENT = 1;
ALTER TABLE booking_idempotency_keys     AUTO_INCREMENT = 1;
ALTER TABLE payment_idempotency_keys     AUTO_INCREMENT = 1;
ALTER TABLE payments                     AUTO_INCREMENT = 1;
ALTER TABLE bookings                     AUTO_INCREMENT = 1;
ALTER TABLE learner_reviews              AUTO_INCREMENT = 1;
ALTER TABLE mentor_reviews               AUTO_INCREMENT = 1;
ALTER TABLE chat_messages                AUTO_INCREMENT = 1;
ALTER TABLE user_certifications          AUTO_INCREMENT = 1;
ALTER TABLE direct_messages              AUTO_INCREMENT = 1;
ALTER TABLE direct_conversations         AUTO_INCREMENT = 1;
ALTER TABLE message_requests             AUTO_INCREMENT = 1;
ALTER TABLE mentor_certifications        AUTO_INCREMENT = 1;
ALTER TABLE session_packages             AUTO_INCREMENT = 1;
ALTER TABLE session_requests             AUTO_INCREMENT = 1;
ALTER TABLE sessions                     AUTO_INCREMENT = 1;
ALTER TABLE mentor_verification_requests AUTO_INCREMENT = 1;
ALTER TABLE mentor_wallets               AUTO_INCREMENT = 1;
ALTER TABLE wallet_ledger_entries        AUTO_INCREMENT = 1;
ALTER TABLE notification_preferences     AUTO_INCREMENT = 1;
ALTER TABLE app_notifications            AUTO_INCREMENT = 1;
ALTER TABLE user_projects                AUTO_INCREMENT = 1;
ALTER TABLE user_availability_slots      AUTO_INCREMENT = 1;
ALTER TABLE saved_mentors                AUTO_INCREMENT = 1;
ALTER TABLE skill_watchlist              AUTO_INCREMENT = 1;
ALTER TABLE user_reports                 AUTO_INCREMENT = 1;
ALTER TABLE user_blocks                  AUTO_INCREMENT = 1;
ALTER TABLE audit_logs                   AUTO_INCREMENT = 1;
ALTER TABLE users                        AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ═════════════════════════════════════════════════════════════════════════════
--  Verification queries
-- ═════════════════════════════════════════════════════════════════════════════
SELECT 'access_token_denylist' AS table_name, COUNT(*) AS cnt FROM access_token_denylist
UNION ALL SELECT 'login_attempts', COUNT(*) FROM login_attempts
UNION ALL SELECT 'refresh_token_sessions', COUNT(*) FROM refresh_token_sessions
UNION ALL SELECT 'referral_rewards', COUNT(*) FROM referral_rewards
UNION ALL SELECT 'learning_roadmaps', COUNT(*) FROM learning_roadmaps
UNION ALL SELECT 'skill_verification_submissions', COUNT(*) FROM skill_verification_submissions
UNION ALL SELECT 'skill_verification_tasks', COUNT(*) FROM skill_verification_tasks
UNION ALL SELECT 'session_waitlist', COUNT(*) FROM session_waitlist
UNION ALL SELECT 'booking_idempotency_keys', COUNT(*) FROM booking_idempotency_keys
UNION ALL SELECT 'payment_idempotency_keys', COUNT(*) FROM payment_idempotency_keys
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'learner_reviews', COUNT(*) FROM learner_reviews
UNION ALL SELECT 'mentor_reviews', COUNT(*) FROM mentor_reviews
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'user_certifications', COUNT(*) FROM user_certifications
UNION ALL SELECT 'direct_messages', COUNT(*) FROM direct_messages
UNION ALL SELECT 'direct_conversations', COUNT(*) FROM direct_conversations
UNION ALL SELECT 'message_requests', COUNT(*) FROM message_requests
UNION ALL SELECT 'mentor_certifications', COUNT(*) FROM mentor_certifications
UNION ALL SELECT 'session_packages', COUNT(*) FROM session_packages
UNION ALL SELECT 'session_requests', COUNT(*) FROM session_requests
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'mentor_verification_requests', COUNT(*) FROM mentor_verification_requests
UNION ALL SELECT 'mentor_wallets', COUNT(*) FROM mentor_wallets
UNION ALL SELECT 'wallet_ledger_entries', COUNT(*) FROM wallet_ledger_entries
UNION ALL SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
UNION ALL SELECT 'app_notifications', COUNT(*) FROM app_notifications
UNION ALL SELECT 'user_projects', COUNT(*) FROM user_projects
UNION ALL SELECT 'user_availability_slots', COUNT(*) FROM user_availability_slots
UNION ALL SELECT 'saved_mentors', COUNT(*) FROM saved_mentors
UNION ALL SELECT 'skill_watchlist', COUNT(*) FROM skill_watchlist
UNION ALL SELECT 'user_reports', COUNT(*) FROM user_reports
UNION ALL SELECT 'user_blocks', COUNT(*) FROM user_blocks
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'skills', COUNT(*) FROM skills
UNION ALL SELECT 'admin_settings', COUNT(*) FROM admin_settings
UNION ALL SELECT 'admin_notif_preferences', COUNT(*) FROM admin_notif_preferences;

SELECT '✅ Database cleanup complete!' AS done;
