CREATE TABLE wallet_withdrawal_idempotency_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    ledger_entry_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_withdrawal_idemp_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_wallet_withdrawal_idemp_ledger FOREIGN KEY (ledger_entry_id) REFERENCES wallet_ledger_entries(id),
    CONSTRAINT uk_wallet_withdrawal_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_wallet_withdrawal_idemp_created
    ON wallet_withdrawal_idempotency_keys(created_at);
