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
}
