-- Remove the referral reward system entirely (non-monetary sharing replaces it).
-- Referral rewards created a monetary liability (₹50 per referred first booking),
-- which SkillSwap no longer supports.

DROP TABLE IF EXISTS referral_rewards;

ALTER TABLE users
    DROP INDEX uq_users_referral_code;

ALTER TABLE users
    DROP COLUMN referral_code;

ALTER TABLE users
    DROP FOREIGN KEY fk_referred_by;

ALTER TABLE users
    DROP COLUMN referred_by_user_id;
