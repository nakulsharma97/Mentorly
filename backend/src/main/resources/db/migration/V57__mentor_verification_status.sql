-- Mentor verification status on the users table.
-- Only APPROVED mentors are discoverable by learners and allowed to use
-- marketplace features (create sessions, publish availability, receive
-- bookings / learner messages). The user-level status is kept in sync by
-- MentorVerificationService on every submission and review decision.

ALTER TABLE users
    ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN verified_at DATETIME(6) NULL,
    ADD COLUMN verified_by BIGINT NULL,
    ADD COLUMN verification_submitted_at DATETIME(6) NULL,
    ADD COLUMN verification_reviewed_at DATETIME(6) NULL,
    ADD COLUMN rejection_reason TEXT NULL;

-- Backfill: mentors already flagged as verified become APPROVED; everyone else
-- keeps the default PENDING (they will be visible only once an admin approves).
UPDATE users
SET verification_status = 'APPROVED'
WHERE mentor_verified = TRUE;

-- Existing verification requests: carry their submission time onto the user row
-- so the mentor dashboard can show when the application was submitted.
UPDATE users u
JOIN mentor_verification_requests r ON r.mentor_id = u.id
SET u.verification_submitted_at = COALESCE(r.submitted_at, r.created_at)
WHERE u.verification_submitted_at IS NULL;
