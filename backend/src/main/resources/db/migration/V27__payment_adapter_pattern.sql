-- Drop payment_idempotency_keys because it references payments(id)
DROP TABLE IF EXISTS payment_idempotency_keys;

-- Drop payments because we are changing the schema completely for adapter pattern
DROP TABLE IF EXISTS payments;

-- Recreate payments table with production-ready fields for adapter pattern
CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    payment_id VARCHAR(255) NULL,
    signature VARCHAR(255) NULL,
    learner_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL,
    gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_learner FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_mentor FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Recreate payment_idempotency_keys with reference to updated payments table
CREATE TABLE payment_idempotency_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    endpoint VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    payment_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_idempotency_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    CONSTRAINT uk_payment_idempotency UNIQUE (user_id, endpoint, idempotency_key)
);

-- Add payment_id column to bookings table and establish foreign key constraint
ALTER TABLE bookings ADD COLUMN payment_id BIGINT NULL;
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- Create mentor_wallets table to store mentor earnings and balances
CREATE TABLE mentor_wallets (
    mentor_id BIGINT PRIMARY KEY,
    total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pending_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mentor_wallets_mentor FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE
);
