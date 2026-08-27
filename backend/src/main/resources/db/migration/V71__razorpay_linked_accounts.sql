CREATE TABLE razorpay_linked_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id BIGINT NOT NULL,
    razorpay_account_id VARCHAR(100) NOT NULL,
    onboarding_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    activated BOOLEAN NOT NULL DEFAULT FALSE,
    last_synced_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_razorpay_linked_accounts_mentor FOREIGN KEY (mentor_id) REFERENCES users(id),
    CONSTRAINT uk_razorpay_linked_accounts_mentor UNIQUE (mentor_id),
    CONSTRAINT uk_razorpay_linked_accounts_razorpay_id UNIQUE (razorpay_account_id)
);

CREATE INDEX idx_razorpay_linked_accounts_status
    ON razorpay_linked_accounts(onboarding_status);
