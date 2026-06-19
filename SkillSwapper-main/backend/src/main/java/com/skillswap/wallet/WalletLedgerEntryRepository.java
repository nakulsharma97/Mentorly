package com.skillswap.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WalletLedgerEntryRepository extends JpaRepository<WalletLedgerEntry, Long> {
    List<WalletLedgerEntry> findByUserIdOrderByCreatedAtDesc(Long userId);
}
