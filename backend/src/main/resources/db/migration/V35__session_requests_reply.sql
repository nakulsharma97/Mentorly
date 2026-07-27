-- Allow learners to reply to mentor's acceptance/decline message
ALTER TABLE session_requests ADD COLUMN reply_message TEXT;
