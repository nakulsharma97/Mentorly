-- ═══════════════════════════════════════════════════════════════
-- Dev-only seed: test accounts (mentor@test.com / learner@test.com)
-- ═══════════════════════════════════════════════════════════════
-- Executed ONLY by DevDataSeeder, which is active only for the
-- @Profile({"dev","local"}) Spring profiles. Production/staging NEVER
-- runs this file — V50__purge_seeded_demo_data.sql removes these
-- accounts everywhere else.
--
-- Password for both test users: password   (dev convenience only)
-- Hash: BCryptPasswordEncoder cost 12 (same hash used by V9).
--
-- Idempotent by convention: DevDataSeeder only executes these scripts
-- when none of the demo accounts exist yet.
-- ═══════════════════════════════════════════════════════════════

-- referral_code is NOT NULL/UNIQUE since V20 and is provided here because
-- this script runs against the LATEST schema (unlike the original V9).
-- INSERT IGNORE (not plain INSERT) so a dev database with PARTIAL demo data
-- self-heals instead of failing on a duplicate email.
INSERT IGNORE INTO users (email, username, password_hash, role, full_name, enabled, referral_code, created_at)
VALUES
  ('mentor@test.com', 'mentor', '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS', 'MENTOR', 'Test Mentor', TRUE, 'MENTOR01', CURRENT_TIMESTAMP),
  ('learner@test.com', 'learner', '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS', 'LEARNER', 'Test Learner', TRUE, 'LEARNER01', CURRENT_TIMESTAMP);

-- Backfill the demo mentor's marketplace card (mirrors the mentor@test.com
-- UPDATE that used to live in V26 before the purge migration).
UPDATE users
SET company = 'SkillSwap',
    headline = 'Senior Software Mentor',
    years_of_experience = 8,
    languages = 'English, Spanish',
    hourly_rate = 60.00,
    response_time_minutes = 120
WHERE email = 'mentor@test.com';
