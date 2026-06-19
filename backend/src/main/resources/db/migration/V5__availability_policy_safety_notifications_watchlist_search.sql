ALTER TABLE sessions
    ADD COLUMN cancellation_window_hours INT NOT NULL DEFAULT 24,
    ADD COLUMN reschedule_window_hours INT NOT NULL DEFAULT 12;

CREATE TABLE user_availability_slots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    day_of_week INT NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_availability_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_blocks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    blocker_id BIGINT NOT NULL,
    blocked_id BIGINT NOT NULL,
    reason VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id),
    CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id),
    CONSTRAINT uq_user_blocks UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE user_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reporter_id BIGINT NOT NULL,
    reported_id BIGINT NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id BIGINT,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_user_reports_reported FOREIGN KEY (reported_id) REFERENCES users(id)
);

CREATE TABLE app_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id BIGINT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE saved_mentors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    learner_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_saved_mentors_learner FOREIGN KEY (learner_id) REFERENCES users(id),
    CONSTRAINT fk_saved_mentors_mentor FOREIGN KEY (mentor_id) REFERENCES users(id),
    CONSTRAINT uq_saved_mentor UNIQUE (learner_id, mentor_id)
);

CREATE TABLE skill_watchlist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    learner_id BIGINT NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_skill_watchlist_learner FOREIGN KEY (learner_id) REFERENCES users(id),
    CONSTRAINT uq_skill_watchlist UNIQUE (learner_id, skill_name)
);

CREATE INDEX idx_availability_user_day ON user_availability_slots(user_id, day_of_week);
CREATE INDEX idx_reports_status ON user_reports(status);
CREATE INDEX idx_notifications_user_read ON app_notifications(user_id, is_read);
CREATE INDEX idx_saved_mentors_mentor ON saved_mentors(mentor_id);
CREATE INDEX idx_skill_watchlist_skill ON skill_watchlist(skill_name);
