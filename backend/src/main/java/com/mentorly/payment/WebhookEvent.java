package com.mentorly.payment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Stores processed webhook events for durable deduplication.
 * Prevents duplicate side effects from retried/duplicate webhook deliveries
 * across server restarts and container deployments.
 */
@Getter
@Setter
@Entity
@Table(name = "webhook_events", uniqueConstraints = @UniqueConstraint(
        name = "uk_webhook_events_gateway_event",
        columnNames = {"gateway", "event_id"}))
public class WebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String gateway;

    @Column(name = "event_id", nullable = false, length = 255)
    private String eventId;

    @Column(name = "event_type", length = 128)
    private String eventType;

    @Column(name = "payload_hash", length = 64)
    private String payloadHash;

    @Column(name = "processing_status", nullable = false, length = 32)
    private String processingStatus = "PROCESSING";

    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt = OffsetDateTime.now();

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;
}
