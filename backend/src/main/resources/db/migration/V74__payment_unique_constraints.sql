-- Prevent duplicate payments for the same gateway order ID
-- (e.g. two rows for the same Razorpay order)
CREATE UNIQUE INDEX uk_payments_gateway_order_id
    ON payments (gateway, order_id);
