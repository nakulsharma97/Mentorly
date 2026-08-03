package com.skillswap.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code WalletLedgerEntry} persistence.
 */
public interface WalletLedgerEntryRepository extends JpaRepository<WalletLedgerEntry, Long> {
    List<WalletLedgerEntry> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<WalletLedgerEntry> findFirstByUserIdOrderByCreatedAtDesc(Long userId);
}
