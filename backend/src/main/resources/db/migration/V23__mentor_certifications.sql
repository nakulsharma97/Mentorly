CREATE TABLE mentor_certifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id BIGINT NOT NULL,
    certification_name VARCHAR(500) NOT NULL,
    issuing_organization VARCHAR(500) NOT NULL,
    credential_id VARCHAR(255),
    issue_date DATE NOT NULL,
    expiry_date DATE,
    certificate_url VARCHAR(1000),
    verification_url VARCHAR(1000),
    certificate_image VARCHAR(1000),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mentor_certifications_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
);

CREATE INDEX idx_mentor_certifications_mentor_id ON mentor_certifications(mentor_id);
