ALTER TABLE users
    ADD COLUMN last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_users_role_last_active ON users(role, last_active_at DESC);
