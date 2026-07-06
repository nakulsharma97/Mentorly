CREATE TABLE refresh_token_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_id VARCHAR(128) NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_refresh_token_sessions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uk_refresh_token_sessions_token_id UNIQUE (token_id)
);

CREATE TABLE payment_idempotency_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    endpoint VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    payment_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_payment_idempotency_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
    CONSTRAINT uk_payment_idempotency UNIQUE (user_id, endpoint, idempotency_key)
);

CREATE INDEX idx_refresh_token_sessions_user_revoked_expiry
    ON refresh_token_sessions(user_id, revoked, expires_at);

CREATE INDEX idx_payment_idempotency_created
    ON payment_idempotency_keys(created_at);

CREATE INDEX idx_bookings_session_status
    ON bookings(session_id, booking_status);

CREATE INDEX idx_payments_status_created
    ON payments(status, created_at);
