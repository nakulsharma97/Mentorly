ALTER TABLE users
    ADD COLUMN projects TEXT NULL,
    ADD COLUMN certificates TEXT NULL,
    ADD COLUMN past_teaching_sessions TEXT NULL,
    ADD COLUMN verified_skills TEXT NULL;

CREATE TABLE session_packages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    session_count INT NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_packages_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE TABLE learning_roadmaps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    milestones TEXT NOT NULL,
    progress_percent INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_learning_roadmaps_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE skill_verification_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id BIGINT NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    instructions TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verification_tasks_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE TABLE skill_verification_submissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    learner_id BIGINT NOT NULL,
    submission_text TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    review_note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verification_submissions_task FOREIGN KEY (task_id) REFERENCES skill_verification_tasks(id),
    CONSTRAINT fk_verification_submissions_learner FOREIGN KEY (learner_id) REFERENCES users(id)
);

CREATE INDEX idx_session_packages_mentor ON session_packages(mentor_id);
CREATE INDEX idx_roadmaps_booking ON learning_roadmaps(booking_id);
CREATE INDEX idx_verification_tasks_mentor ON skill_verification_tasks(mentor_id);
CREATE INDEX idx_verification_submissions_task ON skill_verification_submissions(task_id);
CREATE INDEX idx_verification_submissions_learner ON skill_verification_submissions(learner_id);
