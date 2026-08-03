-- Separate per-flow rate-limit counters.
--
-- Before this migration, login failures and forgot-password requests shared a
-- single counter per IP (one login_attempts row per IP), so one flow could
-- exhaust the other's quota and a login lockout also blocked password resets.
-- Each flow now keeps its own row, keyed by (ip_address, attempt_type).
--
-- Historical rows were all login failures, so they default to LOGIN.
ALTER TABLE login_attempts
    ADD COLUMN attempt_type VARCHAR(20) NOT NULL DEFAULT 'LOGIN';

-- Supports the per-flow lookups: findByIpAddressAndAttemptType(...).
CREATE INDEX idx_login_attempts_ip_type ON login_attempts (ip_address, attempt_type);
