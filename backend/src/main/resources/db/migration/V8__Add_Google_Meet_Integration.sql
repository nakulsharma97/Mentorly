-- Add Google Meet integration columns to sessions table
ALTER TABLE sessions
ADD COLUMN meeting_provider VARCHAR(50) DEFAULT 'GOOGLE_CALENDAR',
ADD COLUMN meeting_id VARCHAR(255),
ADD COLUMN calendar_event_id VARCHAR(255),
ADD COLUMN session_status VARCHAR(50) DEFAULT 'SCHEDULED',
ADD COLUMN created_by BIGINT,
ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add booking approval columns
ALTER TABLE bookings
ADD COLUMN approved_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN approved_at TIMESTAMP NULL,
ADD COLUMN joined_at TIMESTAMP NULL,
ADD COLUMN payment_status VARCHAR(50) DEFAULT 'PENDING';

-- Create indexes
CREATE INDEX idx_sessions_status ON sessions(session_status);
CREATE INDEX idx_sessions_mentor_status ON sessions(mentor_id, session_status);
CREATE INDEX idx_bookings_status_approval ON bookings(booking_status, approved_by_admin);
CREATE INDEX idx_bookings_session_approval ON bookings(session_id, approved_by_admin);
CREATE INDEX idx_bookings_learner_approval ON bookings(learner_id, approved_by_admin);