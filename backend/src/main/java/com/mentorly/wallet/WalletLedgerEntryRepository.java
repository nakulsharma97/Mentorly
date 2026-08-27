package com.mentorly.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code WalletLedgerEntry} persistence.
 */
public interface WalletLedgerEntryRepository extends JpaRepository<WalletLedgerEntry, Long> {
    List<WalletLedgerEntry> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<WalletLedgerEntry> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

    /** Find a withdrawal entry by its gateway transfer ID (Stripe or Razorpay). */
    Optional<WalletLedgerEntry> findByGatewayTransferId(String gatewayTransferId);
}
