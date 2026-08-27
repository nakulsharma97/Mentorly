package com.mentorly.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for wallet withdrawal idempotency key persistence.
 */
public interface WalletWithdrawalIdempotencyKeyRepository extends JpaRepository<WalletWithdrawalIdempotencyKey, Long> {

    Optional<WalletWithdrawalIdempotencyKey> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);
}
