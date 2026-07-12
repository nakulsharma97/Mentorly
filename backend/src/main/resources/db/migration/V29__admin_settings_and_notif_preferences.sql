-- Add table for DB-backed admin settings (platform_fee_percent, maintenance_mode, etc.)
CREATE TABLE IF NOT EXISTS admin_settings (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    setting_key     VARCHAR(100)    NOT NULL UNIQUE,
    setting_value   VARCHAR(500)    NOT NULL,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default settings
INSERT INTO admin_settings (setting_key, setting_value) VALUES
    ('platform_fee_percent', '10'),
    ('min_withdrawal_amount', '10'),
    ('max_session_participants', '10'),
    ('maintenance_mode', 'false'),
    ('new_registrations_enabled', 'true'),
    ('mentor_verification_required', 'true'),
    ('report_schedule_frequency', 'none')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Add table for admin notification preferences
CREATE TABLE IF NOT EXISTS admin_notif_preferences (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    pref_key        VARCHAR(100)    NOT NULL UNIQUE,
    pref_value      TINYINT(1)      NOT NULL DEFAULT 1,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default notification preferences
INSERT INTO admin_notif_preferences (pref_key, pref_value) VALUES
    ('new_user_signups', 1),
    ('reports_filed', 1),
    ('failed_payments', 1),
    ('mentor_verifications', 1),
    ('daily_summary', 0),
    ('new_bookings', 1)
ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value);
