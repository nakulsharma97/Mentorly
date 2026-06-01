CREATE TABLE notification_preferences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    booking_updates BOOLEAN NOT NULL DEFAULT TRUE,
    session_announcements BOOLEAN NOT NULL DEFAULT TRUE,
    review_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    certification_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    role_change_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_notification_preferences_user UNIQUE (user_id)
);

CREATE TABLE user_certifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    code VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL,
    source_booking_id BIGINT,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_certifications_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_certifications_booking FOREIGN KEY (source_booking_id) REFERENCES bookings(id),
    CONSTRAINT uq_user_certification_code UNIQUE (user_id, code)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_user_certifications_user_issued ON user_certifications(user_id, issued_at DESC);
