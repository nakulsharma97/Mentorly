CREATE TABLE webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    gateway VARCHAR(32) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(128),
    payload_hash VARCHAR(64),
    processing_status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    CONSTRAINT uk_webhook_events_gateway_event UNIQUE (gateway, event_id)
);

CREATE INDEX idx_webhook_events_gateway_status
    ON webhook_events(gateway, processing_status, received_at);

CREATE INDEX idx_webhook_events_received
    ON webhook_events(received_at);
