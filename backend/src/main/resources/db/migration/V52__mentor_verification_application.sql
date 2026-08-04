-- Mentor verification: full application form support.
--
-- 1. Snapshot the applicant's form fields on the request itself (the user may
--    later edit their profile, but the admin reviews what was submitted).
-- 2. Add MORE_INFORMATION_REQUIRED support via the `requested_info` column
--    (stores what the admin asked the applicant to provide/clarify).
-- 3. `submitted_at` records when the application was submitted.

ALTER TABLE mentor_verification_requests
    ADD COLUMN full_name VARCHAR(255) NULL,
    ADD COLUMN email VARCHAR(255) NULL,
    ADD COLUMN skills TEXT NULL,
    ADD COLUMN years_of_experience INT NULL,
    ADD COLUMN bio TEXT NULL,
    ADD COLUMN resume_url VARCHAR(1000) NULL,
    ADD COLUMN certificate_urls TEXT NULL,
    ADD COLUMN linkedin_url VARCHAR(500) NULL,
    ADD COLUMN github_url VARCHAR(500) NULL,
    ADD COLUMN portfolio_url VARCHAR(500) NULL,
    ADD COLUMN hourly_rate NUMERIC(12,2) NULL,
    ADD COLUMN availability VARCHAR(255) NULL,
    ADD COLUMN submitted_at TIMESTAMP NULL,
    ADD COLUMN requested_info VARCHAR(1000) NULL;
