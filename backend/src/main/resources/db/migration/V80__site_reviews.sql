-- Site reviews: one platform-wide ("Share your review") review per user.
-- PENDING until an admin approves it, then it appears on the public landing page.
-- Hosted MySQL runs with sql_require_primary_key=ON, so an explicit surrogate
-- primary key is declared (never CREATE TABLE ... AS SELECT).

CREATE TABLE site_reviews (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    rating INT NOT NULL,
    title VARCHAR(120) NULL,
    comment TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_site_reviews_user UNIQUE (user_id),
    CONSTRAINT fk_site_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_site_reviews_status_created (status, created_at)
);
