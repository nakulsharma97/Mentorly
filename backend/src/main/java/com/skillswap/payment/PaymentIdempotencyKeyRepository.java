package com.skillswap.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code PaymentIdempotencyKey} persistence.
 */
public interface PaymentIdempotencyKeyRepository extends JpaRepository<PaymentIdempotencyKey, Long> {

    Optional<PaymentIdempotencyKey> findByUserIdAndEndpointAndIdempotencyKey(Long userId, String endpoint,
            String idempotencyKey);
}
