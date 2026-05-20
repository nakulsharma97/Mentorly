CREATE TABLE wallet_ledger_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(30) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'CREDITS',
    description VARCHAR(255) NOT NULL,
    reference_type VARCHAR(60),
    reference_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_ledger_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_wallet_ledger_user_created ON wallet_ledger_entries(user_id, created_at);
CREATE INDEX idx_wallet_ledger_reference ON wallet_ledger_entries(reference_type, reference_id);
