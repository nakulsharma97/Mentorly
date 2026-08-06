-- ─────────────────────────────────────────────────────────────────────────────
-- V55: Mandatory Profile Completion Flow
--
-- Adds the `profile_completed` flag (default FALSE) plus the onboarding
-- profile columns required by the Complete Profile flow. New signups start at
-- FALSE and must finish onboarding before accessing core features. Existing
-- users who already filled their core profile data are backfilled to TRUE so
-- the mandatory flow only gates genuinely incomplete accounts.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN profile_completed    BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN country              VARCHAR(100) NULL,
    ADD COLUMN state                VARCHAR(100) NULL,
    ADD COLUMN city                 VARCHAR(100) NULL,
    ADD COLUMN phone_number         VARCHAR(40)  NULL,
    ADD COLUMN timezone             VARCHAR(64)  NULL,
    ADD COLUMN education            TEXT         NULL,
    ADD COLUMN portfolio_url        VARCHAR(1000) NULL,
    ADD COLUMN availability         TEXT         NULL,
    ADD COLUMN learning_goals       TEXT         NULL,
    ADD COLUMN current_skill_level  VARCHAR(32)  NULL;

-- Admins are exempt from the onboarding flow entirely.
UPDATE users SET profile_completed = TRUE WHERE role = 'ADMIN';

-- Mentors/learners who already filled their core profile are treated as
-- complete so the mandatory onboarding only applies to new/incomplete users.
UPDATE users
SET profile_completed = TRUE
WHERE role IN ('MENTOR', 'LEARNER')
  AND about_me IS NOT NULL AND about_me <> ''
  AND skills IS NOT NULL AND skills <> ''
  AND profile_image_url IS NOT NULL AND profile_image_url <> '';
