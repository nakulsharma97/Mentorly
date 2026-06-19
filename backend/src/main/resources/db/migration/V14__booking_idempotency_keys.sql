CREATE TABLE booking_idempotency_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    endpoint VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    booking_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_booking_idempotency_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT uk_booking_idempotency UNIQUE (user_id, endpoint, idempotency_key)
);

CREATE INDEX idx_booking_idempotency_created
    ON booking_idempotency_keys(created_at);
