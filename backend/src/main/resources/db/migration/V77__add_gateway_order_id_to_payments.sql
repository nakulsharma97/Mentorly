-- V77: Add gateway_order_id to payments table.
-- This stores the real Razorpay/Stripe order ID (e.g. order_xxx, pi_xxx)
-- separate from the internal ORDER_xxxx id, so HMAC verification uses the
-- real gateway order ID rather than the internal synthetic id.
ALTER TABLE payments ADD COLUMN gateway_order_id VARCHAR(255);

-- Index for fast lookups by gateway order ID (webhook reconciliation)
CREATE INDEX idx_payments_gateway_order_id ON payments(gateway_order_id);
