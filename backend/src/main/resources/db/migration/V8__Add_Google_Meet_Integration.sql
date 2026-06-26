-- Add Google Meet integration columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS meeting_provider VARCHAR(50) DEFAULT 'GOOGLE_CALENDAR';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS meeting_id VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_status VARCHAR(50) DEFAULT 'SCHEDULED';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_by BIGINT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add booking approval columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_by_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor_status ON sessions(mentor_id, session_status);
CREATE INDEX IF NOT EXISTS idx_bookings_status_approval ON bookings(booking_status, approved_by_admin);
CREATE INDEX IF NOT EXISTS idx_bookings_session_approval ON bookings(session_id, approved_by_admin);
CREATE INDEX IF NOT EXISTS idx_bookings_learner_approval ON bookings(learner_id, approved_by_admin);
