ALTER TABLE mentor_reviews
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'APPROVED';

ALTER TABLE learner_reviews
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'APPROVED';

CREATE INDEX idx_mentor_reviews_status_created ON mentor_reviews(status, created_at DESC);
CREATE INDEX idx_learner_reviews_status_created ON learner_reviews(status, created_at DESC);
