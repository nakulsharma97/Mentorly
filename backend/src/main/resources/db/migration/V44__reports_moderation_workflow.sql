-- ════════════════════════════════════════════════════════════════
-- V44: Reports moderation workflow
--
-- Extends `user_reports` so the admin reports queue can run a real
-- triage workflow:
--   * priority         — LOW / MEDIUM / HIGH / CRITICAL triage level
--   * assigned_admin_id — admin currently investigating the report
--   * internal_notes   — free-form investigator notes (not shown to users)
--   * deleted_at       — soft-delete for spam reports (keeps FK integrity,
--                        so reporter/reported history survives)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE user_reports
    ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN assigned_admin_id BIGINT NULL,
    ADD COLUMN internal_notes TEXT NULL,
    ADD COLUMN deleted_at DATETIME(6) NULL,
    ADD CONSTRAINT fk_user_reports_assigned_admin
        FOREIGN KEY (assigned_admin_id) REFERENCES users(id);

CREATE INDEX idx_reports_status_priority ON user_reports(status, priority);
CREATE INDEX idx_reports_created_at ON user_reports(created_at);
