-- ═══════════════════════════════════════════════════════════════
-- V38: Add username column to users table
--
-- Root cause: The User.java entity has a @Column(nullable = false,
-- unique = true) field for `username`, but no Flyway migration
-- was ever created to add this column to the database.
--
-- With spring.jpa.hibernate.ddl-auto=validate, Hibernate checks
-- the entity against the DB schema at startup and fails with:
--   Schema-validation: missing column [username] in table [users]
--
-- This column is required for the global unique username system
-- (GitHub/Instagram-style @username identifiers).
-- ═══════════════════════════════════════════════════════════════

-- Add the username column. For existing rows, generate a username
-- from the email (take the part before @ and append a suffix if needed).
ALTER TABLE users ADD COLUMN username VARCHAR(255);

-- Generate usernames for existing users based on their email.
-- If the generated username conflicts, append the user's ID.
UPDATE users SET username = LOWER(SUBSTRING_INDEX(email, '@', 1))
WHERE username IS NULL;

-- Resolve duplicate usernames by appending the user ID.
-- This is a multi-step process:
-- 1. First pass: for users whose username conflicts, append their ID.
UPDATE users u1
  JOIN (SELECT username FROM users GROUP BY username HAVING COUNT(*) > 1) dupes
    ON u1.username = dupes.username
  SET u1.username = CONCAT(u1.username, u1.id);

-- After resolving duplicates, make the column NOT NULL and UNIQUE.
ALTER TABLE users MODIFY username VARCHAR(255) NOT NULL;
ALTER TABLE users ADD CONSTRAINT uk_users_username UNIQUE (username);
