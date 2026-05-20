ALTER TABLE users
    ADD COLUMN mentor_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sessions
    ADD COLUMN max_participants INT NOT NULL DEFAULT 1;

ALTER TABLE payments
    ADD COLUMN refund_percent INT NULL,
    ADD COLUMN refund_amount NUMERIC(12,2) NULL,
    ADD COLUMN refund_note VARCHAR(500) NULL;

ALTER TABLE user_reports
    ADD COLUMN escalated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN escalation_level INT NULL,
    ADD COLUMN escalation_reason VARCHAR(500) NULL,
    ADD COLUMN escalated_at TIMESTAMP NULL;

CREATE TABLE mentor_verification_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id BIGINT NOT NULL,
    document_url VARCHAR(1000) NOT NULL,
    document_type VARCHAR(100) NULL,
    status VARCHAR(50) NOT NULL,
    admin_note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verification_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE INDEX idx_verification_mentor_created ON mentor_verification_requests(mentor_id, created_at DESC);
CREATE INDEX idx_verification_status_created ON mentor_verification_requests(status, created_at ASC);

CREATE TABLE learner_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    learner_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_learner_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT fk_learner_reviews_mentor FOREIGN KEY (mentor_id) REFERENCES users(id),
    CONSTRAINT fk_learner_reviews_learner FOREIGN KEY (learner_id) REFERENCES users(id),
    CONSTRAINT chk_learner_reviews_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT uq_learner_reviews_booking UNIQUE (booking_id)
);

CREATE INDEX idx_learner_reviews_learner_created ON learner_reviews(learner_id, created_at DESC);
CREATE INDEX idx_learner_reviews_mentor ON learner_reviews(mentor_id);

CREATE TABLE session_waitlist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    learner_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_waitlist_session FOREIGN KEY (session_id) REFERENCES sessions(id),
    CONSTRAINT fk_waitlist_learner FOREIGN KEY (learner_id) REFERENCES users(id)
);

CREATE INDEX idx_waitlist_learner_created ON session_waitlist(learner_id, created_at DESC);
CREATE INDEX idx_waitlist_session_status_created ON session_waitlist(session_id, status, created_at ASC);
