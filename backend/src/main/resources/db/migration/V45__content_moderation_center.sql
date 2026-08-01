-- ════════════════════════════════════════════════════════════════
-- V45: Content Moderation Center
--
-- Dedicated moderation pipeline that is separate from user reports:
--   * flagged_content    — one row per flagged item (content type, id,
--                          preview, owner, reporter, detection source,
--                          reason, priority, status, AI confidence, notes)
--   * flagged_content_events — append-only moderation timeline so every
--                          state change (reported → assigned → approved /
--                          removed / suspended) is preserved for review.
--
-- Kept in its own table so auto-detection (AI, spam, profanity, scam,
-- etc.) can flag content without polluting the user_reports queue, which
-- stays the manual complaints channel.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE flagged_content (
    id BIGINT NOT NULL AUTO_INCREMENT,
    content_type VARCHAR(50) NOT NULL,
    content_id BIGINT NULL,
    content_preview TEXT NULL,
    owner_id BIGINT NULL,
    reporter_id BIGINT NULL,
    detection_source VARCHAR(50) NOT NULL DEFAULT 'MANUAL_REPORT',
    reason VARCHAR(500) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
    ai_confidence DOUBLE NULL,
    assigned_moderator_id BIGINT NULL,
    internal_notes TEXT NULL,
    escalation_level INT NULL,
    escalation_reason VARCHAR(500) NULL,
    escalated_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_flagged_content_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT fk_flagged_content_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_flagged_content_moderator FOREIGN KEY (assigned_moderator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_flagged_content_status ON flagged_content(status);
CREATE INDEX idx_flagged_content_type ON flagged_content(content_type);
CREATE INDEX idx_flagged_content_priority ON flagged_content(priority);
CREATE INDEX idx_flagged_content_created ON flagged_content(created_at);
CREATE INDEX idx_flagged_content_detection ON flagged_content(detection_source);

CREATE TABLE flagged_content_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    flagged_content_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id BIGINT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NULL,
    note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_fce_item FOREIGN KEY (flagged_content_id) REFERENCES flagged_content(id) ON DELETE CASCADE,
    CONSTRAINT fk_fce_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_fce_item ON flagged_content_events(flagged_content_id);
CREATE INDEX idx_fce_created ON flagged_content_events(created_at);
