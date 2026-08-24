package com.skillswap.wallet;

import com.skillswap.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Encapsulates wallet ledger entry.
 */
@Getter
@Setter
@Entity
@Table(name = "wallet_ledger_entries")
public class WalletLedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WalletTransactionType type;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal balanceAfter;

    @Column(nullable = false)
    private String currency = "INR";

    @Column(nullable = false)
    private String description;

    @Column(name = "reference_type")
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    /** Status of an outgoing payout (null for non-withdrawal entries). */
    @Enumerated(EnumType.STRING)
    @Column(name = "payout_status", length = 32)
    private PayoutStatus payoutStatus;

    /** Stripe Transfer ID when a real payout was initiated via Stripe Connect. */
    @Column(name = "stripe_transfer_id", length = 255)
    private String stripeTransferId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
