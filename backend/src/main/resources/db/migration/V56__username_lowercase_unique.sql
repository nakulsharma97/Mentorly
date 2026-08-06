-- ═══════════════════════════════════════════════════════════════
-- V56: Case-insensitive username uniqueness
--
-- Usernames are unique handles (GitHub/LinkedIn style): `nakul`,
-- `Nakul` and `NAKUL` must be treated as the SAME username. The
-- `username` column stores the display value exactly as the user
-- saved it; this migration adds a normalized lowercase copy
-- (`username_lower`) with its own UNIQUE constraint so the database
-- itself enforces case-insensitive uniqueness — never only the
-- application layer.
-- ═══════════════════════════════════════════════════════════════

-- 1. Defensive cleanup: if any existing rows already differ only by
--    case (possible only if data was inserted outside the app, which
--    always stores lowercase), append the row id to make them unique.
--    Mirrors the dedup pattern used by V38.
UPDATE users u1
  JOIN (SELECT LOWER(username) AS ul, COUNT(*) AS c
        FROM users GROUP BY LOWER(username) HAVING c > 1) dups
    ON LOWER(u1.username) = dups.ul
  SET u1.username = CONCAT(u1.username, u1.id);

-- 2. Add the normalized (lowercase) column.
ALTER TABLE users ADD COLUMN username_lower VARCHAR(255);

-- 3. Backfill existing rows from the display username.
UPDATE users SET username_lower = LOWER(username) WHERE username_lower IS NULL;

-- 4. Enforce NOT NULL + uniqueness. From here on the DB rejects any
--    second row whose lowercase username matches an existing one,
--    closing the simultaneous-registration race window.
ALTER TABLE users MODIFY username_lower VARCHAR(255) NOT NULL;
ALTER TABLE users ADD CONSTRAINT uk_users_username_lower UNIQUE (username_lower);
