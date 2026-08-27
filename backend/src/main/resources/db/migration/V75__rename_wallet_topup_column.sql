-- Rename the Stripe-specific column to a gateway-neutral name.
-- Uses RENAME COLUMN (supported by MySQL 8.0+, H2, PostgreSQL).
-- On older MySQL, use: ALTER TABLE wallet_top_ups CHANGE stripe_payment_intent_id gateway_payment_id VARCHAR(255);
ALTER TABLE wallet_top_ups RENAME COLUMN stripe_payment_intent_id TO gateway_payment_id;
