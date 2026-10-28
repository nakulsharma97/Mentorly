-- Soft deletion for user accounts.
--
-- Admin "Delete user" used to only anonymise + disable the row, so the record
-- kept coming back in the admin user list (there was nothing to filter on).
-- deleted_at marks the account as deleted: the admin list excludes it while
-- bookings, payments, wallet ledger entries, reviews and audit history keep
-- their foreign keys. enabled (disabled) stays a separate state.

ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;

CREATE INDEX idx_users_deleted_at ON users (deleted_at);

-- Backfill accounts that were "deleted" by the old flow. That flow stamped
-- password_hash with '[DELETED]' (and only that flow ever wrote that value),
-- so these rows are unambiguously deleted and would otherwise keep reappearing
-- in the admin user list forever.
UPDATE users
   SET deleted_at = COALESCE(last_active_at, created_at, CURRENT_TIMESTAMP)
 WHERE deleted_at IS NULL
   AND password_hash = '[DELETED]';
