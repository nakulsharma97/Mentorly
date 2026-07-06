CREATE TABLE user_projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    technologies VARCHAR(1000) NOT NULL,
    github_url VARCHAR(500),
    live_demo_url VARCHAR(500),
    start_date DATE NOT NULL,
    end_date DATE,
    currently_working BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_projects_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
