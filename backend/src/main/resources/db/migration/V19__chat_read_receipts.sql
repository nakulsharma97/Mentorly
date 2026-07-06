ALTER TABLE chat_messages
    ADD COLUMN read_by_recipient BOOLEAN NOT NULL DEFAULT FALSE;