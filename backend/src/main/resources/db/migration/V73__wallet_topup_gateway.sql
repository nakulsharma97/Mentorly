ALTER TABLE wallet_top_ups
    ADD COLUMN gateway VARCHAR(32) NOT NULL DEFAULT 'stripe' AFTER wallet_credited;
