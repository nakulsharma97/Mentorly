-- ═══════════════════════════════════════════════════════════════
-- V50: Purge seeded demo/test data from ALL environments
-- ═══════════════════════════════════════════════════════════════
--
-- Background
-- ----------
-- V9__insert_test_users.sql and V39__seed_sample_data.sql (plus the
-- mentor@test.com backfill inside V26__mentor_profile_fields.sql) seeded
-- development/demo accounts into EVERY environment — including production.
-- Those accounts all share one well-known public password hash, so anyone
-- could log in to them on a deployed database.
--
-- This migration deletes those accounts and all related data (sessions,
-- bookings, reviews, payments, chat, notifications, wallets, etc.) so no
-- environment is left holding default credentials or fake records.
--
-- Flyway history preservation
-- ---------------------------
-- The original seeding migrations (V9/V39) are intentionally LEFT
-- UNTOUCHED. Rewriting or deleting an already-applied migration would fail
-- Flyway checksum validation on every existing database. Instead this
-- migration runs AFTER them everywhere:
--   * existing databases  → the demo rows are deleted here
--   * fresh databases     → V9/V39 create the rows, V50 removes them again
-- Both paths are safe and fully idempotent (all statements are no-ops when
-- the demo data is already gone).
--
-- Development experience
-- ----------------------
-- Local development still gets the demo data: the @Profile({"dev","local"})
-- DevDataSeeder re-creates exactly this data on dev databases at startup.
-- Production/staging databases never run the seeder.
--
-- Implementation note
-- -------------------
-- The demo-id sets are materialized into REGULAR tables (not TEMPORARY):
-- MySQL refuses to reopen a TEMPORARY table more than once per statement
-- (error 1137), and several DELETE statements below reference the same set
-- twice (e.g. mentor_id OR learner_id). Flyway serializes migrations with a
-- schema lock, so concurrent runs cannot collide. The tables are dropped
-- again at the end and guarded with DROP TABLE IF EXISTS so a re-run (or a
-- retry after an unrelated failure) is always safe.
-- ═══════════════════════════════════════════════════════════════

-- ── Snapshot the demo account ids (created by V9 + V39) ──────────
DROP TABLE IF EXISTS _flyway_tmp_demo_user_ids;
CREATE TABLE _flyway_tmp_demo_user_ids AS
SELECT id FROM users WHERE email IN (
    'mentor@test.com', 'learner@test.com',
    'priya.sharma@example.com', 'raj.patel@example.com',
    'sarah.chen@example.com', 'amit.kumar@example.com',
    'emma.wilson@example.com',
    'alex.johnson@example.com', 'maria.garcia@example.com'
);

-- ── Snapshot related ids so deletes stay consistent ──────────────
DROP TABLE IF EXISTS _flyway_tmp_demo_session_ids;
CREATE TABLE _flyway_tmp_demo_session_ids AS
SELECT id FROM sessions WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

DROP TABLE IF EXISTS _flyway_tmp_demo_booking_ids;
CREATE TABLE _flyway_tmp_demo_booking_ids AS
SELECT id FROM bookings
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR session_id IN (SELECT id FROM _flyway_tmp_demo_session_ids);

DROP TABLE IF EXISTS _flyway_tmp_demo_payment_ids;
CREATE TABLE _flyway_tmp_demo_payment_ids AS
SELECT id FROM payments
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR session_id IN (SELECT id FROM _flyway_tmp_demo_session_ids);

DROP TABLE IF EXISTS _flyway_tmp_demo_conversation_ids;
CREATE TABLE _flyway_tmp_demo_conversation_ids AS
SELECT id FROM direct_conversations
WHERE participant_one_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR participant_two_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

DROP TABLE IF EXISTS _flyway_tmp_demo_task_ids;
CREATE TABLE _flyway_tmp_demo_task_ids AS
SELECT id FROM skill_verification_tasks WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

DROP TABLE IF EXISTS _flyway_tmp_demo_broadcast_ids;
CREATE TABLE _flyway_tmp_demo_broadcast_ids AS
SELECT id FROM notification_broadcasts WHERE created_by IN (SELECT id FROM _flyway_tmp_demo_user_ids);

DROP TABLE IF EXISTS _flyway_tmp_demo_flagged_ids;
CREATE TABLE _flyway_tmp_demo_flagged_ids AS
SELECT id FROM flagged_content
WHERE owner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR reporter_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR assigned_moderator_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- ── Delete children before parents (FK-safe order) ───────────────

-- Reviews (reference bookings + users)
DELETE FROM mentor_reviews
WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM learner_reviews
WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Things that reference demo bookings
DELETE FROM learning_roadmaps WHERE booking_id IN (SELECT id FROM _flyway_tmp_demo_booking_ids);
DELETE FROM chat_messages
WHERE booking_id IN (SELECT id FROM _flyway_tmp_demo_booking_ids)
   OR sender_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM referral_rewards
WHERE booking_id IN (SELECT id FROM _flyway_tmp_demo_booking_ids)
   OR referee_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR referrer_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM user_certifications
WHERE source_booking_id IN (SELECT id FROM _flyway_tmp_demo_booking_ids)
   OR user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM booking_idempotency_keys
WHERE booking_id IN (SELECT id FROM _flyway_tmp_demo_booking_ids)
   OR user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Bookings + payments. bookings.payment_id references payments, so
-- bookings must be removed BEFORE payments; both are covered here in order
DELETE FROM bookings
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR session_id IN (SELECT id FROM _flyway_tmp_demo_session_ids);
DELETE FROM payments
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR session_id IN (SELECT id FROM _flyway_tmp_demo_session_ids);
DELETE FROM payment_idempotency_keys
WHERE payment_id IN (SELECT id FROM _flyway_tmp_demo_payment_ids)
   OR user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM session_waitlist
WHERE session_id IN (SELECT id FROM _flyway_tmp_demo_session_ids)
   OR learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Sessions + packages offered by demo mentors
DELETE FROM sessions WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM session_packages WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Requests / submissions
DELETE FROM session_requests
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM skill_requests WHERE requested_by IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM skill_verification_submissions
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR task_id IN (SELECT id FROM _flyway_tmp_demo_task_ids);
DELETE FROM skill_verification_tasks WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM message_requests
WHERE sender_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR receiver_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Direct messaging
DELETE FROM direct_messages
WHERE sender_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR conversation_id IN (SELECT id FROM _flyway_tmp_demo_conversation_ids);
DELETE FROM direct_conversations
WHERE participant_one_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR participant_two_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Notifications
DELETE FROM app_notifications
WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR broadcast_id IN (SELECT id FROM _flyway_tmp_demo_broadcast_ids);
DELETE FROM notification_preferences WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM notification_broadcasts WHERE created_by IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Auth sessions / audit / wallet / files / profile extras
DELETE FROM refresh_token_sessions WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM wallet_ledger_entries WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM mentor_wallets WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM stored_files WHERE owner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM user_availability_slots WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM user_blocks
WHERE blocker_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR blocked_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM user_projects WHERE user_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM mentor_certifications WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM mentor_verification_requests WHERE mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Moderation / reports
DELETE FROM flagged_content_events
WHERE actor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR flagged_content_id IN (SELECT id FROM _flyway_tmp_demo_flagged_ids);
DELETE FROM flagged_content
WHERE owner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR reporter_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR assigned_moderator_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM user_reports
WHERE reporter_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR reported_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR assigned_admin_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Saved / watched
DELETE FROM saved_mentors
WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids)
   OR mentor_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);
DELETE FROM skill_watchlist WHERE learner_id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- Detach real users that were referred by a demo account, so the
-- self-referencing FK (users.referred_by_user_id) never blocks the delete.
UPDATE users u
JOIN (SELECT id FROM _flyway_tmp_demo_user_ids) d ON u.referred_by_user_id = d.id
SET u.referred_by_user_id = NULL;

-- ── Finally, the demo users themselves ───────────────────────────
DELETE FROM users WHERE id IN (SELECT id FROM _flyway_tmp_demo_user_ids);

-- ── Cleanup ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS _flyway_tmp_demo_user_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_session_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_booking_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_payment_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_conversation_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_task_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_broadcast_ids;
DROP TABLE IF EXISTS _flyway_tmp_demo_flagged_ids;
