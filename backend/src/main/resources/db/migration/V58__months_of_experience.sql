-- Precise mentor experience duration: years + month remainder (0–11).
-- Lets mentors record "0 years (fresher)", "3 months", or "1 year 6 months"
-- while keeping the existing years_of_experience column fully compatible.
ALTER TABLE users
    ADD COLUMN months_of_experience INT NULL AFTER years_of_experience;

-- Mirror the month remainder onto mentor verification applications so the
-- admin review panel sees the exact duration the applicant submitted.
ALTER TABLE mentor_verification_requests
    ADD COLUMN months_of_experience INT NULL AFTER years_of_experience;
