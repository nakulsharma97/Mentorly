-- ══════════════════════════════════════════════════════════════════
--  Complete Admin Profile: nakulsharma@gmail.com
--  Fills all profile fields, creates related records
-- ══════════════════════════════════════════════════════════════════

-- 1. Update all profile fields for the admin
UPDATE users
SET
  about_me              = 'Platform administrator and founder of SkillSwap. Passionate about skill-based learning and peer-to-peer education.',
  skills                = 'Platform Management, Community Moderation, Strategic Planning',
  github_url            = 'https://github.com/nakulsharma97',
  linkedin_url          = 'https://linkedin.com/in/nakulsharma97',
  wallet_address        = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  profile_image_url     = NULL
WHERE email = 'nakulsharma@gmail.com';

-- 2. Create notification preferences if not exists
INSERT IGNORE INTO notification_preferences (user_id, email_enabled, booking_updates, session_announcements, review_alerts, certification_alerts, role_change_alerts)
VALUES (1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);

-- 3. Create mentor wallet entry (admin needs wallet for platform operations)
INSERT IGNORE INTO mentor_wallets (mentor_id, total_earnings, available_balance, pending_balance)
VALUES (1, 0.00, 0.00, 0.00);

-- 4. Verify the complete profile
SELECT
  id, email, full_name, role, admin_sub_role, enabled,
  about_me, skills, github_url, linkedin_url, wallet_address
FROM users WHERE email = 'nakulsharma@gmail.com';

-- Check notification preferences
SELECT 'Notification preferences:' AS info, id, user_id, email_enabled, booking_updates, session_announcements FROM notification_preferences WHERE user_id = 1;

-- Check mentor wallet
SELECT 'Mentor wallet:' AS info, mentor_id, total_earnings, available_balance, pending_balance FROM mentor_wallets WHERE mentor_id = 1;

SELECT '✅ Admin profile completed successfully!' AS result;
