CREATE TABLE mentor_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    learner_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mentor_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT fk_mentor_reviews_mentor FOREIGN KEY (mentor_id) REFERENCES users(id),
    CONSTRAINT fk_mentor_reviews_learner FOREIGN KEY (learner_id) REFERENCES users(id),
    CONSTRAINT chk_mentor_reviews_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT uq_mentor_reviews_booking UNIQUE (booking_id)
);

CREATE INDEX idx_mentor_reviews_mentor_created ON mentor_reviews(mentor_id, created_at DESC);
CREATE INDEX idx_mentor_reviews_learner ON mentor_reviews(learner_id);
