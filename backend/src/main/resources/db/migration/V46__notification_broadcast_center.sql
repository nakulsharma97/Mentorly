-- ════════════════════════════════════════════════════════════════
-- V46: Notification & Broadcast Center
--
-- Adds the broadcast-campaign concept on top of the existing per-user
-- app_notifications pipeline:
--   * notification_broadcasts — one row per admin-created campaign
--     (title, subtitle, message, type, priority, target audience spec,
--     schedule/repeat/expiry, action button, delivery counters, status)
--   * app_notifications gains per-delivery tracking so read / click /
--     dismiss / expiry can be measured per broadcast:
--       - priority, broadcast_id (link back to the campaign)
--       - read_at / clicked_at / dismissed_at / expires_at timestamps
--       - action_url / action_button_text for interactive notifications
--       - delivery_status (DELIVERED / FAILED / EXPIRED / DISMISSED)
--
-- Existing rows are untouched (new columns nullable / defaulted), so the
-- current notification center keeps working without a backfill.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE notification_broadcasts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(500) NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'ANNOUNCEMENT',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    -- Target audience
    target_scope VARCHAR(40) NOT NULL DEFAULT 'ALL',
    target_detail TEXT NULL,
    -- Scheduling
    schedule_time DATETIME(6) NULL,
    sent_at DATETIME(6) NULL,
    expires_at DATETIME(6) NULL,
    repeat_type VARCHAR(20) NOT NULL DEFAULT 'NONE',
    -- Interactive action button
    action_button_text VARCHAR(100) NULL,
    action_url VARCHAR(1000) NULL,
    -- Delivery counters (maintained by the send path)
    total_targets INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    read_count INT NOT NULL DEFAULT 0,
    clicked_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    -- Audit / lifecycle
    created_by BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    cancelled_at DATETIME(6) NULL,
    archived_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_broadcast_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_broadcast_status ON notification_broadcasts(status);
CREATE INDEX idx_broadcast_type ON notification_broadcasts(type);
CREATE INDEX idx_broadcast_priority ON notification_broadcasts(priority);
CREATE INDEX idx_broadcast_schedule ON notification_broadcasts(schedule_time);
CREATE INDEX idx_broadcast_created ON notification_broadcasts(created_at);

-- ── Extend per-delivery rows with broadcast tracking ──
ALTER TABLE app_notifications
    ADD COLUMN broadcast_id BIGINT NULL,
    ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN read_at DATETIME(6) NULL,
    ADD COLUMN clicked_at DATETIME(6) NULL,
    ADD COLUMN dismissed_at DATETIME(6) NULL,
    ADD COLUMN expires_at DATETIME(6) NULL,
    ADD COLUMN action_url VARCHAR(1000) NULL,
    ADD COLUMN action_button_text VARCHAR(100) NULL,
    ADD COLUMN delivery_status VARCHAR(20) NOT NULL DEFAULT 'DELIVERED';

ALTER TABLE app_notifications
    ADD CONSTRAINT fk_notification_broadcast FOREIGN KEY (broadcast_id)
        REFERENCES notification_broadcasts(id);

CREATE INDEX idx_notifications_broadcast ON app_notifications(broadcast_id);
CREATE INDEX idx_notifications_read_at ON app_notifications(read_at);
CREATE INDEX idx_notifications_type ON app_notifications(type);
