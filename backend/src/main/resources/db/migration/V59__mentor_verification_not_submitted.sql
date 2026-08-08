-- Mentor verification lifecycle: introduce the explicit NOT_SUBMITTED default
-- (fresh accounts that have never applied) and backfill the user-level status
-- for requests that are awaiting more information.
--
-- The request table already supports MORE_INFORMATION_REQUIRED; this migration
-- only mirrors that state onto the users table so the mentor dashboard banner
-- can render the correct "Additional Information Required" card.

ALTER TABLE users
    MODIFY COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'NOT_SUBMITTED';

-- Existing accounts that were never flagged as verified and have no
-- verification request are really NOT_SUBMITTED, not PENDING.
UPDATE users u
LEFT JOIN mentor_verification_requests r ON r.mentor_id = u.id
SET u.verification_status = 'NOT_SUBMITTED'
WHERE u.verification_status = 'PENDING'
  AND u.mentor_verified = FALSE
  AND r.id IS NULL;

-- Mirrors the request-level MORE_INFORMATION_REQUIRED onto the user row so the
-- dashboard shows the required-changes banner (instead of generic under review).
UPDATE users u
JOIN mentor_verification_requests r ON r.mentor_id = u.id
SET u.verification_status = 'MORE_INFORMATION_REQUIRED'
WHERE r.status = 'MORE_INFORMATION_REQUIRED'
  AND u.mentor_verified = FALSE;
