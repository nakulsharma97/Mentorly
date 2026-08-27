-- V76: Gateway-neutral field naming for wallet ledger + top-up tables.
-- Backward-compatible: renames columns and adds indexes without deleting data.

-- 1. Rename wallet_ledger_entries.stripe_transfer_id → gateway_transfer_id
ALTER TABLE wallet_ledger_entries RENAME COLUMN stripe_transfer_id TO gateway_transfer_id;

-- 2. Add gateway_order_id to wallet_top_ups (Razorpay returns order_id separately from payment_id)
ALTER TABLE wallet_top_ups ADD COLUMN gateway_order_id VARCHAR(255);

-- 3. Index for fast transfer-ID lookups in webhook processing (replaces the old findAll().stream())
CREATE INDEX idx_ledger_entries_gateway_transfer_id ON wallet_ledger_entries(gateway_transfer_id);

-- 4. Index for fast top-up lookups by gateway payment ID (webhook reconciliation)
CREATE INDEX idx_wallet_top_ups_gateway_payment_id ON wallet_top_ups(gateway_payment_id);
