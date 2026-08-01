-- ═══════════════════════════════════════════════════════════════
-- V41: Skill Requests
--
-- Enables the "approve new skill categories" workflow: any user can
-- submit a new skill category, and admins approve or reject it.
-- When approved, the Skill row is created (or kept if it already
-- exists). `requested_by` is intentionally a soft FK to users so a
-- deleted account does not break the moderation history.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE skill_requests (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    category      VARCHAR(255) NOT NULL,
    status        VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    requested_by  BIGINT       NOT NULL,
    admin_note    VARCHAR(500),
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NULL,
    CONSTRAINT fk_skill_requests_user FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE INDEX idx_skill_requests_status ON skill_requests(status);
CREATE INDEX idx_skill_requests_requested_by ON skill_requests(requested_by);
