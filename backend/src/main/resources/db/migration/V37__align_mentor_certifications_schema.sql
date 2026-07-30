-- ═══════════════════════════════════════════════════════════════
-- V37: Align mentor_certifications table schema with the JPA entity
--
-- Root cause of 404 error:
-- The Flyway migration V23 created the table with OLD column names
-- (expiry_date, certificate_url, verification_url) that DON'T MATCH
-- the current JPA entity (MentorCertification.java), which expects
-- expiration_date, credential_url, does_not_expire, skills_covered.
--
-- With spring.jpa.hibernate.ddl-auto=validate, Hibernate validates
-- the entity against the actual DB schema at startup. The mismatch
-- causes validation failure, preventing the app from starting fully
-- and resulting in 404 errors for certification endpoints.
--
-- This migration drops the old table and recreates it with the
-- correct column names matching the JPA entity.
-- ═══════════════════════════════════════════════════════════════

-- Drop old table and FK constraint
DROP TABLE IF EXISTS mentor_certifications;

-- Recreate with schema matching MentorCertification.java
CREATE TABLE mentor_certifications (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id       BIGINT       NOT NULL,
    certification_name     VARCHAR(500) NOT NULL,
    issuing_organization   VARCHAR(500) NOT NULL,
    credential_id   VARCHAR(500),
    credential_url  VARCHAR(1000),
    issue_date      DATE         NOT NULL,
    expiration_date DATE,
    does_not_expire BOOLEAN      NOT NULL DEFAULT FALSE,
    skills_covered  TEXT,
    description     TEXT,
    certificate_image VARCHAR(1000),
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_mentor_certifications_mentor
        FOREIGN KEY (mentor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_mentor_certifications_mentor_id
    ON mentor_certifications(mentor_id);
