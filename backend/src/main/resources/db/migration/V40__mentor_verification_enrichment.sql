-- Mentor Verification module enrichment.
--
-- 1. Let mentors attach a resume document (URL) that admins review during
--    the verification process.
-- 2. Record WHO reviewed a verification request and WHEN, so the saved
--    status carries an audit trail (requirement: "Save verification status").

ALTER TABLE users
    ADD COLUMN resume_url VARCHAR(1000) NULL;

ALTER TABLE mentor_verification_requests
    ADD COLUMN reviewed_by BIGINT NULL,
    ADD COLUMN reviewed_at TIMESTAMP NULL;
