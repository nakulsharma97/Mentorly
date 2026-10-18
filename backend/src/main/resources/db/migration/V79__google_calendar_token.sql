-- Persist the organisation-wide Google Calendar OAuth token so Meet links keep
-- working across application restarts/redeploys (the previous FileDataStore was
-- wiped on every deploy).
--
-- Aiven MySQL runs with sql_require_primary_key=ON, therefore this table is
-- created with an explicit surrogate primary key (never CREATE TABLE ... AS SELECT).
CREATE TABLE google_calendar_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    account_key VARCHAR(100) NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token TEXT NULL,
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_google_calendar_tokens_account_key UNIQUE (account_key)
);
