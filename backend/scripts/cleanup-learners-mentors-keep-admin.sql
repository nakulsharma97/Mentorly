-- ═══════════════════════════════════════════════════════════════════════════
--  SkillSwap — Cleanup LEARNER + MENTOR users (keep ADMIN only)
--
--  Deletes ALL learner/mentor users and every record that belongs to them,
--  while preserving:
--    ✓ All ADMIN users (identified by role, never by hardcoded id)
--    ✓ admin_settings / admin_notif_preferences (system configuration)
--    ✓ skills, career_paths + roadmap_* catalog tables (system content)
--    ✓ Admin-owned rows in shared tables (audit_logs, flagged_content,
--      user_reports, notification_broadcasts, app_notifications, …)
--    ✓ flyway_schema_history (migration bookkeeping)
--
--  Roles are identified from the users.role column ('LEARNER'/'MENTOR') —
--  nothing is matched on email, username, name, or hardcoded ids.
--
--  Strategy:
--    • The set of non-admin user ids is snapshotted into a TEMPORARY table.
--    • Child rows are deleted in foreign-key-safe order (FK checks stay ON,
--      so a missed dependency fails loudly instead of leaving orphans).
--    • The final step deletes the users themselves by role.
--
--  Usage (backup first!):
--    mysqldump ... skill > backup-before-cleanup-$(date +%Y%m%d-%H%M%S).sql
--    mysql -u root -p skill < cleanup-learners-mentors-keep-admin.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Snapshot the non-admin user ids (role-based, admin-protected) ──
-- NOTE: a regular table is used (not TEMPORARY) because MySQL 8 cannot reopen
-- a temporary table multiple times within a single statement (ERROR 1137).
-- It is dropped at the end of this script.
DROP TABLE IF EXISTS tmp_non_admin_ids;
CREATE TABLE tmp_non_admin_ids AS
SELECT id FROM users WHERE role IN ('LEARNER', 'MENTOR');
CREATE INDEX idx_tmp_non_admin_ids ON tmp_non_admin_ids (id);

SELECT '=== Pre-cleanup totals (for reference) ===' AS step;
SELECT 'non-admin users (LEARNER+MENTOR)' AS item, COUNT(*) AS value FROM tmp_non_admin_ids
UNION ALL SELECT 'ADMIN users', COUNT(*) FROM users WHERE role = 'ADMIN'
UNION ALL SELECT 'admin_settings', COUNT(*) FROM admin_settings
UNION ALL SELECT 'admin_notif_preferences', COUNT(*) FROM admin_notif_preferences
UNION ALL SELECT 'skills (system master)', COUNT(*) FROM skills
UNION ALL SELECT 'career_paths (system catalog)', COUNT(*) FROM career_paths;

-- ── 1. Transient auth (no user FK) — safe to clear entirely ──
DELETE FROM access_token_denylist; SELECT 'access_token_denylist' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM login_attempts;        SELECT 'login_attempts'        AS table_name, ROW_COUNT() AS deleted;

-- ── 2. Direct user-scoped children (leaf tables first) ──
DELETE FROM refresh_token_sessions       WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'refresh_token_sessions' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM message_requests             WHERE sender_id IN (SELECT id FROM tmp_non_admin_ids) OR receiver_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'message_requests' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM user_blocks                  WHERE blocker_id IN (SELECT id FROM tmp_non_admin_ids) OR blocked_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'user_blocks' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM skill_verification_tasks     WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'skill_verification_tasks' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM skill_verification_submissions WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids) OR task_id IN (SELECT id FROM skill_verification_tasks WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'skill_verification_submissions' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM skill_requests               WHERE requested_by IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'skill_requests' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM skill_watchlist              WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'skill_watchlist' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM mentor_certifications        WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'mentor_certifications' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM mentor_verification_requests WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'mentor_verification_requests' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM mentor_wallets               WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'mentor_wallets' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM wallet_ledger_entries        WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'wallet_ledger_entries' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM stored_files                 WHERE owner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'stored_files' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM audit_logs                   WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'audit_logs' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM notification_preferences     WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'notification_preferences' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM app_notifications            WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'app_notifications' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM notification_broadcasts      WHERE created_by IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'notification_broadcasts' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM user_availability_slots      WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'user_availability_slots' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM user_projects                WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'user_projects' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM user_reports                 WHERE reporter_id IN (SELECT id FROM tmp_non_admin_ids) OR reported_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'user_reports' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM user_certifications          WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'user_certifications' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM session_notes                WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'session_notes' AS table_name, ROW_COUNT() AS deleted;

-- ── 3. Flagged-content moderation (owned/reported by non-admin users) ──
DELETE FROM flagged_content_events
 WHERE actor_id IN (SELECT id FROM tmp_non_admin_ids)
    OR flagged_content_id IN (SELECT id FROM flagged_content WHERE owner_id IN (SELECT id FROM tmp_non_admin_ids) OR reporter_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'flagged_content_events' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM flagged_content
 WHERE owner_id IN (SELECT id FROM tmp_non_admin_ids) OR reporter_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'flagged_content' AS table_name, ROW_COUNT() AS deleted;

-- ── 4. Learning history / progress (learner-scoped) ──
DELETE FROM roadmap_progress   WHERE learner_roadmap_id IN (SELECT id FROM learner_roadmaps WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'roadmap_progress' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM roadmap_certificates WHERE learner_roadmap_id IN (SELECT id FROM learner_roadmaps WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'roadmap_certificates' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM learner_roadmaps   WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'learner_roadmaps' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM learner_tasks      WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'learner_tasks' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM learner_todos      WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'learner_todos' AS table_name, ROW_COUNT() AS deleted;

-- ── 5. Messaging (conversation-scoped children first) ──
DELETE FROM direct_messages
 WHERE sender_id IN (SELECT id FROM tmp_non_admin_ids)
    OR conversation_id IN (SELECT id FROM direct_conversations WHERE participant_one_id IN (SELECT id FROM tmp_non_admin_ids) OR participant_two_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'direct_messages' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM direct_conversations
 WHERE participant_one_id IN (SELECT id FROM tmp_non_admin_ids) OR participant_two_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'direct_conversations' AS table_name, ROW_COUNT() AS deleted;

-- ── 6. Reviews (involve a learner and a mentor by definition) ──
DELETE FROM learner_reviews WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids) OR mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'learner_reviews' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM mentor_reviews  WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids) OR mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'mentor_reviews' AS table_name, ROW_COUNT() AS deleted;

-- ── 7. Requests / waitlist / saved / packages ──
DELETE FROM session_requests WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids) OR mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'session_requests' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM session_waitlist WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'session_waitlist' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM saved_mentors    WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids) OR mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'saved_mentors' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM session_packages WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'session_packages' AS table_name, ROW_COUNT() AS deleted;

-- ── 8. Bookings / payments / sessions / idempotency ──
-- Order matters: bookings reference sessions + payments, and payments
-- reference sessions. So: booking children → bookings → payments → sessions.
DELETE FROM chat_messages
 WHERE sender_id IN (SELECT id FROM tmp_non_admin_ids)
    OR booking_id IN (SELECT id FROM bookings WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'chat_messages' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM learning_roadmaps
 WHERE booking_id IN (SELECT id FROM bookings WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids));
SELECT 'learning_roadmaps' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM booking_idempotency_keys WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'booking_idempotency_keys' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM bookings WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'bookings' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM payment_idempotency_keys WHERE user_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'payment_idempotency_keys' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM payments WHERE learner_id IN (SELECT id FROM tmp_non_admin_ids) OR mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'payments' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM sessions  WHERE mentor_id IN (SELECT id FROM tmp_non_admin_ids);
SELECT 'sessions' AS table_name, ROW_COUNT() AS deleted;

-- ── 9. Users — role-based, admin protected ──
DELETE FROM users WHERE role IN ('LEARNER', 'MENTOR');
SELECT 'users (LEARNER+MENTOR deleted)' AS table_name, ROW_COUNT() AS deleted;

-- ── 10. Orphan sweep ──
-- Earlier resets ran with FOREIGN_KEY_CHECKS = 0 and could leave rows whose
-- user FK points at already-deleted user ids. The role-based deletes above
-- cannot catch those (the ids were gone before the snapshot), so sweep every
-- FK column to users for dangling references. All remaining rows reference the
-- admin (id exists), so anything swept is by definition learner/mentor data.
DELETE FROM app_notifications           WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
SELECT 'app_notifications (orphan sweep)' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM audit_logs                  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
SELECT 'audit_logs (orphan sweep)' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM mentor_verification_requests WHERE mentor_id IS NOT NULL AND mentor_id NOT IN (SELECT id FROM users);
SELECT 'mentor_verification_requests (orphan sweep)' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM notification_preferences    WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
SELECT 'notification_preferences (orphan sweep)' AS table_name, ROW_COUNT() AS deleted;
DELETE FROM refresh_token_sessions      WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
SELECT 'refresh_token_sessions (orphan sweep)' AS table_name, ROW_COUNT() AS deleted;

DROP TABLE tmp_non_admin_ids;

-- ═══════════════════════════════════════════════════════════
--  Verification
-- ═══════════════════════════════════════════════════════════
SELECT '=== Post-cleanup verification ===' AS step;
SELECT 'ADMIN users remaining' AS check_name, COUNT(*) AS value FROM users WHERE role = 'ADMIN';
SELECT 'LEARNER users remaining' AS check_name, COUNT(*) AS value FROM users WHERE role = 'LEARNER';
SELECT 'MENTOR users remaining' AS check_name, COUNT(*) AS value FROM users WHERE role = 'MENTOR';
SELECT 'users total' AS check_name, COUNT(*) AS value FROM users;
SELECT 'admin_settings unchanged' AS check_name, COUNT(*) AS value FROM admin_settings;
SELECT 'admin_notif_preferences unchanged' AS check_name, COUNT(*) AS value FROM admin_notif_preferences;
SELECT 'skills (system master) unchanged' AS check_name, COUNT(*) AS value FROM skills;
SELECT 'career_paths (system catalog) unchanged' AS check_name, COUNT(*) AS value FROM career_paths;

-- Dynamic orphan scan: EVERY FK column to users must report 0 orphans.
SET SESSION group_concat_max_len = 1000000;
SELECT GROUP_CONCAT(
  CONCAT(
    'SELECT ''', TABLE_NAME, '.', COLUMN_NAME, ''' AS check_name, COUNT(*) AS value FROM ', TABLE_NAME,
    ' WHERE ', COLUMN_NAME, ' IS NOT NULL AND ', COLUMN_NAME, ' NOT IN (SELECT id FROM users)'
  ) SEPARATOR ' UNION ALL '
) INTO @orphan_sql
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'users';
SET @orphan_sql = CONCAT(@orphan_sql, ' UNION ALL SELECT ''(no user-FK tables)'' AS check_name, 0 AS value');
PREPARE orphan_stmt FROM @orphan_sql;
EXECUTE orphan_stmt;
DEALLOCATE PREPARE orphan_stmt;

SELECT '✅ Cleanup complete: learners + mentors removed, admins preserved, zero orphans.' AS done;
