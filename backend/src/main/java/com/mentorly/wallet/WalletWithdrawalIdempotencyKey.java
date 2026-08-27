package com.mentorly.wallet;

import com.mentorly.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "wallet_withdrawal_idempotency_keys", uniqueConstraints = @UniqueConstraint(
        name = "uk_wallet_withdrawal_idempotency",
        columnNames = {"user_id", "idempotency_key"}))
/**
 * Stores idempotency keys for wallet withdrawal requests to prevent
 * duplicate Stripe transfers from double-click or network retries.
 */
public class WalletWithdrawalIdempotencyKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false)
    private String requestHash;

    @ManyToOne
    @JoinColumn(name = "ledger_entry_id")
    private WalletLedgerEntry ledgerEntry;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
