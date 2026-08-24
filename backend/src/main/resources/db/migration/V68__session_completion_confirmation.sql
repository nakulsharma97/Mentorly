-- ═══════════════════════════════════════════════════════════════════
-- Session Completion: Dual Confirmation with Admin Dispute Evidence
-- ═══════════════════════════════════════════════════════════════════

-- Lightweight join-link-request timestamps (real signals, not heartbeat tracking)
ALTER TABLE bookings
    ADD COLUMN learner_join_link_requested_at DATETIME NULL,
    ADD COLUMN mentor_join_link_requested_at DATETIME NULL;

-- Mutual confirmation statuses
ALTER TABLE bookings
    ADD COLUMN learner_confirmation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN mentor_confirmation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN learner_confirmed_at DATETIME NULL,
    ADD COLUMN mentor_confirmed_at DATETIME NULL,
    ADD COLUMN learner_dispute_reason TEXT NULL,
    ADD COLUMN mentor_dispute_reason TEXT NULL;

-- Overall completion review status
ALTER TABLE bookings
    ADD COLUMN completion_review_status VARCHAR(32) NOT NULL DEFAULT 'NOT_APPLICABLE';
