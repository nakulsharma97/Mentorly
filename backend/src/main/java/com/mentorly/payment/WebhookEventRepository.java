package com.mentorly.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code WebhookEvent} persistence.
 * Used for durable webhook deduplication across server restarts.
 */
public interface WebhookEventRepository extends JpaRepository<WebhookEvent, Long> {

    Optional<WebhookEvent> findByGatewayAndEventId(String gateway, String eventId);

    boolean existsByGatewayAndEventId(String gateway, String eventId);
    @org.springframework.data.jpa.repository.Modifying
@org.springframework.data.jpa.repository.Query(
        value = """
                INSERT IGNORE INTO webhook_events
                (gateway, event_id, event_type, received_at, processing_status)
                VALUES (:gateway, :eventId, :eventType, :receivedAt, 'PROCESSING')
                """,
        nativeQuery = true
)
int insertIfAbsent(
        @org.springframework.data.repository.query.Param("gateway") String gateway,
        @org.springframework.data.repository.query.Param("eventId") String eventId,
        @org.springframework.data.repository.query.Param("eventType") String eventType,
        @org.springframework.data.repository.query.Param("receivedAt") java.time.OffsetDateTime receivedAt
);
}
