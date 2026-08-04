-- Chat enhancements: reactions, pinned and archived conversations.
--
-- 1. direct_messages.reactions — JSON object mapping emoji -> [userIds] so a
--    message can carry per-user reactions (e.g. {"👍":[1,5],"❤️":[2]}).
-- 2. direct_conversations.pinned / archived — per-user flags so participants
--    can pin or archive a conversation independently.

ALTER TABLE direct_messages
    ADD COLUMN reactions TEXT NULL;

ALTER TABLE direct_conversations
    ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
