package com.skillswap.booking;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code BookingIdempotencyKey} persistence.
 */
public interface BookingIdempotencyKeyRepository extends JpaRepository<BookingIdempotencyKey, Long> {

    Optional<BookingIdempotencyKey> findByUserIdAndEndpointAndIdempotencyKey(Long userId, String endpoint,
            String idempotencyKey);
}
