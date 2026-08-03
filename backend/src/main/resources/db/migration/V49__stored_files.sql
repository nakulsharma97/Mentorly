-- File metadata for chat attachments.
--
-- Every upload is recorded here so downloads can be authorized (owner /
-- chat participants / admins only) and expired files can be purged. The
-- on-disk filename is the UUID stored in stored_name (kept unguessable);
-- original_name is only used for display/download naming.
CREATE TABLE stored_files (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    stored_name    VARCHAR(255) NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    content_type   VARCHAR(255) NOT NULL,
    size_bytes     BIGINT       NOT NULL,
    owner_id       BIGINT       NOT NULL,
    context_type   VARCHAR(20),
    context_id     BIGINT,
    created_at     TIMESTAMP    NOT NULL,
    expires_at     TIMESTAMP    NOT NULL,
    CONSTRAINT uq_stored_files_stored_name UNIQUE (stored_name),
    CONSTRAINT fk_stored_files_owner FOREIGN KEY (owner_id) REFERENCES users (id)
);

-- Fast lookup of expired files for the scheduled purge.
CREATE INDEX idx_stored_files_expires_at ON stored_files (expires_at);
-- Fast lookup of all files owned by one user (future "my uploads" list).
CREATE INDEX idx_stored_files_owner_id ON stored_files (owner_id);
