-- ═══════════════════════════════════════════════════════════════════
-- Stripe Connect: Mentor Connect Accounts & Payout Tracking
-- ═══════════════════════════════════════════════════════════════════

-- One Connect account per mentor for Stripe Express onboarding.
CREATE TABLE mentor_connect_accounts (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentor_id         BIGINT       NOT NULL,
    stripe_account_id VARCHAR(255) NOT NULL,
    onboarding_status VARCHAR(32)  NOT NULL DEFAULT 'NOT_STARTED',
    payouts_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_mca_mentor FOREIGN KEY (mentor_id) REFERENCES users (id),
    CONSTRAINT uk_mca_mentor UNIQUE (mentor_id),
    CONSTRAINT uk_mca_stripe UNIQUE (stripe_account_id)
);

-- Payout tracking on wallet ledger entries.
ALTER TABLE wallet_ledger_entries
    ADD COLUMN payout_status     VARCHAR(32)  NULL,
    ADD COLUMN stripe_transfer_id VARCHAR(255) NULL;
