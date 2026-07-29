-- ══════════════════════════════════════════════════════════════════
--  Create single admin user: nakulsharma@gmail.com / nakul97
-- ══════════════════════════════════════════════════════════════════

-- First, check existing admins
SELECT 'Existing admins before cleanup:' AS info, id, email, role, admin_sub_role
FROM users WHERE role = 'ADMIN';

-- Delete any existing admin users to ensure only one
DELETE FROM users WHERE role = 'ADMIN';

-- Insert the new admin user
INSERT INTO users (email, password_hash, role, admin_sub_role, full_name, enabled, referral_code, created_at, last_active_at)
VALUES (
  'nakulsharma@gmail.com',
  '$2b$10$Ipa2EqIojXVPXTRl.fmLFu4bhsJNBP25DaYa7uYVzaQOqNxgAaRJW',
  'ADMIN',
  'SUPER_ADMIN',
  'Nakul Sharma',
  TRUE,
  'NAKUL001',
  NOW(),
  NOW()
);

-- Verify
SELECT 'Created admin:' AS info, id, email, role, admin_sub_role, full_name
FROM users WHERE email = 'nakulsharma@gmail.com';

SELECT '✅ Admin user created successfully!' AS result;
SELECT '   Email:    nakulsharma@gmail.com' AS detail
UNION ALL
SELECT '   Password: nakul97';
