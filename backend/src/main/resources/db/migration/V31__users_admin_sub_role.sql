-- Add admin_sub_role column to users table for admin sub-role support
ALTER TABLE users ADD COLUMN admin_sub_role VARCHAR(50) NULL AFTER message_privacy;
