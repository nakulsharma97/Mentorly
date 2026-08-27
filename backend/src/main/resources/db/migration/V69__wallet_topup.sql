-- Wallet top-up records: tracks real-money payments that credit the learner wallet.
-- Uses Stripe PaymentIntent for the actual charge; the internal record is separate
-- from the booking-related `payments` table to keep concerns cleanly separated.

CREATE TABLE wallet_top_ups (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    order_id        VARCHAR(128) NOT NULL UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    amount          DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(8)   NOT NULL DEFAULT 'INR',
    status          VARCHAR(32)  NOT NULL DEFAULT 'INITIATED',
    -- INITIATED → SUCCEEDED → (no further states for top-ups)
    --           → FAILED
    wallet_credited BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_wallet_topup_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_wallet_topup_user    ON wallet_top_ups(user_id);
CREATE INDEX idx_wallet_topup_order   ON wallet_top_ups(order_id);
CREATE INDEX idx_wallet_topup_stripe  ON wallet_top_ups(stripe_payment_intent_id);
