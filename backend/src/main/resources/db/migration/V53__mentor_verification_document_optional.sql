-- Mentor verification: identity proof is optional.
--
-- The application form treats the identity/verification document as optional
-- (the resume URL doubles as identity evidence when no document is provided).
-- The original NOT NULL constraint would reject any application that omits the
-- document — silently failing submissions and leaving the admin queue empty.
-- Relax it so applications with only a resume (or social links) can proceed.

ALTER TABLE mentor_verification_requests
    MODIFY document_url VARCHAR(1000) NULL;
