-- Mentor marketplace profile fields used by Find Mentors search, filtering and cards.
ALTER TABLE users
    ADD COLUMN company VARCHAR(150) NULL,
    ADD COLUMN headline VARCHAR(200) NULL,
    ADD COLUMN years_of_experience INT NULL,
    ADD COLUMN languages VARCHAR(300) NULL,
    ADD COLUMN hourly_rate NUMERIC(12,2) NULL,
    ADD COLUMN response_time_minutes INT NULL;

-- Extend the mentor full-text index to cover the new searchable columns
-- (company + headline) so keyword search stays fully backend-driven.
ALTER TABLE users
    DROP INDEX idx_mentor_fulltext;

ALTER TABLE users
    ADD FULLTEXT INDEX idx_mentor_fulltext (full_name, about_me, skills, company, headline);

-- Give every mentor a sensible default language so cards never render empty.
UPDATE users
SET languages = 'English'
WHERE role = 'MENTOR' AND (languages IS NULL OR languages = '');

-- Backfill the seeded demo mentor so a fresh database shows a complete card.
UPDATE users
SET company = 'SkillSwap',
    headline = 'Senior Software Mentor',
    years_of_experience = 8,
    languages = 'English, Spanish',
    hourly_rate = 60.00,
    response_time_minutes = 120
WHERE email = 'mentor@test.com';
