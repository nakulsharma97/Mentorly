-- Track failed login attempts per IP address for brute-force protection
-- The AuthService uses this to enforce exponential backoff
CREATE TABLE login_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255),
    attempt_count INT NOT NULL DEFAULT 1,
    last_attempt_at DATETIME(6) NOT NULL,
    blocked_until DATETIME(6),
    expires_at DATETIME(6),
    INDEX idx_login_attempts_ip (ip_address),
    INDEX idx_login_attempts_email (email),
    INDEX idx_login_attempts_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
