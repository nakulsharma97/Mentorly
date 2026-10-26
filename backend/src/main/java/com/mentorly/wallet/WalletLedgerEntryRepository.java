package com.mentorly.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code WalletLedgerEntry} persistence.
 */
public interface WalletLedgerEntryRepository extends JpaRepository<WalletLedgerEntry, Long> {

    /**
     * Ledger history, newest first. The {@code id} tie-breaker is required:
     * {@code created_at} is a second-precision TIMESTAMP in MySQL while the
     * entity writes {@code OffsetDateTime.now()} with nanos, so two entries
     * written in the same second compare equal and the database is free to
     * return them in any order — which would reverse the visible history and,
     * worse, make the balance read below ambiguous.
     */
    List<WalletLedgerEntry> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    /**
     * Current balance source: the single newest ledger row. Same tie-breaker
     * rationale as above — on equal timestamps the highest AUTO_INCREMENT id
     * is the row that was actually written last, so the wallet can never read
     * a stale {@code balance_after} and hand out money twice.
     */
    Optional<WalletLedgerEntry> findFirstByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    /** Find a withdrawal entry by its gateway transfer ID (Stripe or Razorpay). */
    Optional<WalletLedgerEntry> findByGatewayTransferId(String gatewayTransferId);
}
