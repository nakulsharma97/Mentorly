-- Add extra fields for session requests: subject, preferred date/time, duration, budget
ALTER TABLE session_requests ADD COLUMN subject VARCHAR(255) NULL;
ALTER TABLE session_requests ADD COLUMN preferred_date VARCHAR(50) NULL;
ALTER TABLE session_requests ADD COLUMN preferred_time VARCHAR(20) NULL;
ALTER TABLE session_requests ADD COLUMN preferred_duration INT NULL;
ALTER TABLE session_requests ADD COLUMN budget VARCHAR(50) NULL;
