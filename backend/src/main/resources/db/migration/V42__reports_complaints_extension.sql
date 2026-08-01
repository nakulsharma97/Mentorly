-- ════════════════════════════════════════════════════════════════
-- V42: Reports & Complaints module
--
-- Extends `user_reports` so users can report non-user targets:
--   * reported_id is now nullable — session and skill reports have no
--     "reported user" to point at.
--   * target_label stores the display name of the target (session title,
--     skill name, or reported user full name) so the admin queue can show
--     exactly what was reported without joins.
--   * moderator_note records the admin's resolution note.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE user_reports
    MODIFY reported_id BIGINT NULL,
    ADD COLUMN target_label VARCHAR(255) NULL,
    ADD COLUMN moderator_note VARCHAR(1000) NULL;

CREATE INDEX idx_reports_status_target_type ON user_reports(status, target_type);
