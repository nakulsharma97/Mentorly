ALTER TABLE users
    ADD COLUMN referral_code VARCHAR(12) NOT NULL DEFAULT '';

ALTER TABLE users
    ADD COLUMN referred_by_user_id BIGINT NULL;

UPDATE users
SET referral_code = SUBSTRING(MD5(RAND()), 1, 8)
WHERE referral_code = '';

ALTER TABLE users
    ADD CONSTRAINT uq_users_referral_code UNIQUE (referral_code);

ALTER TABLE users
    ADD CONSTRAINT fk_referred_by FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE referral_rewards (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  referrer_id BIGINT NOT NULL,
  referee_id BIGINT NOT NULL,
  booking_id BIGINT NOT NULL,
  rewarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rr_referrer FOREIGN KEY (referrer_id) REFERENCES users(id),
  CONSTRAINT fk_rr_referee FOREIGN KEY (referee_id) REFERENCES users(id),
  CONSTRAINT fk_rr_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT uq_referee_reward UNIQUE (referee_id)
);