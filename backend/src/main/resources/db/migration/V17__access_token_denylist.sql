CREATE TABLE access_token_denylist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    jti VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_access_token_denylist_jti UNIQUE (jti)
);

CREATE INDEX idx_access_token_denylist_expires_at
    ON access_token_denylist(expires_at);