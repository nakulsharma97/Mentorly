-- Add reference_id for Razorpay Linked Account (used as unique business identifier)
ALTER TABLE razorpay_linked_accounts
    ADD COLUMN reference_id VARCHAR(255);

-- Track product configuration status (Razorpay Route requires product config before transfers)
ALTER TABLE razorpay_linked_accounts
    ADD COLUMN product_config_status VARCHAR(32) DEFAULT 'NOT_CONFIGURED';

-- Index for faster lookups by reference_id
CREATE INDEX idx_razorpay_linked_accounts_reference_id ON razorpay_linked_accounts(reference_id);
