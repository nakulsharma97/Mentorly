-- Session Requests: learner-initiated requests for custom sessions
-- A learner can request a session from a mentor without an existing session slot.
-- The mentor can accept (which triggers session creation) or reject.

CREATE TABLE session_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    learner_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    message TEXT,
    decline_reason TEXT,
    session_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    CONSTRAINT fk_session_requests_learner FOREIGN KEY (learner_id) REFERENCES users(id),
    CONSTRAINT fk_session_requests_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE INDEX idx_session_requests_mentor_status ON session_requests(mentor_id, status);
CREATE INDEX idx_session_requests_learner ON session_requests(learner_id);
