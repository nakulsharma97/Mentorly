-- Add password reset support to users table
ALTER TABLE users
    ADD COLUMN password_reset_token VARCHAR(255) NULL,
    ADD COLUMN password_reset_token_expiry DATETIME(6) NULL;
