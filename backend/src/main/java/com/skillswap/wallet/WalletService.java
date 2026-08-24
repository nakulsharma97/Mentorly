package com.skillswap.wallet;

import com.skillswap.payout.StripeConnectService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Service implementing wallet business logic.
 */
@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletLedgerEntryRepository ledgerRepository;
    private final UserRepository userRepository;
    @Lazy
    private final StripeConnectService stripeConnectService;

    public List<WalletLedgerEntry> history(User user) {
        return ledgerRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public WalletBalance balance(User user) {
        BigDecimal balance = ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(user.getId())
                .map(WalletLedgerEntry::getBalanceAfter)
                .orElse(BigDecimal.ZERO);
        return new WalletBalance(balance, "INR");
    }

    @Transactional
    public WalletLedgerEntry addEntry(User currentUser, WalletEntryRequest request) {
        return addEntryForUser(currentUser.getId(), request);
    }

    @Transactional
    public WalletLedgerEntry addEntryForUser(Long userId, WalletEntryRequest request) {
        User user = userRepository.findByIdWithLock(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BigDecimal currentBalance = balance(user).balance();
        BigDecimal signedAmount = switch (request.type()) {
            case CREDIT, EARNING, REFUND -> request.amount().abs();
            case DEBIT, WITHDRAWAL -> request.amount().signum() >= 0 ? request.amount().negate() : request.amount();
        };
        BigDecimal nextBalance = currentBalance.add(signedAmount);

        if (nextBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Insufficient wallet balance");
        }

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setUser(user);
        entry.setType(request.type());
        entry.setAmount(signedAmount);
        entry.setBalanceAfter(nextBalance);
        entry.setCurrency(request.currency() == null || request.currency().isBlank() ? "INR" : request.currency());
        entry.setDescription(request.description());
        entry.setReferenceType(request.referenceType());
        entry.setReferenceId(request.referenceId());
        return ledgerRepository.save(entry);
    }

    @Transactional
    public WalletLedgerEntry withdraw(User currentUser, WithdrawRequest request) {
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be greater than zero");
        }

        if (request.amount().compareTo(balance(currentUser).balance()) > 0) {
            throw new IllegalArgumentException("Insufficient wallet balance for withdrawal");
        }

        if (request.amount().compareTo(new BigDecimal("10.00")) < 0) {
            throw new IllegalArgumentException("Minimum withdrawal amount is ₹10.00");
        }

        // ── Stripe Connect payout path ──
        // Create the ledger entry first (sets payout_status = PENDING), then
        // initiate the real Stripe Transfer. If the transfer fails, the entry
        // is rolled back by the transactional boundary.
        WalletLedgerEntry entry = addEntry(currentUser, new WalletEntryRequest(
                WalletTransactionType.WITHDRAWAL,
                request.amount(),
                "INR",
                request.description() != null && !request.description().isBlank()
                        ? request.description()
                        : "Wallet withdrawal to bank account",
                "WITHDRAWAL",
                null));

        // Attempt real payout via Stripe Connect (if available for this mentor)
        try {
            entry.setPayoutStatus(PayoutStatus.PENDING);
            entry = ledgerRepository.save(entry);
            entry = stripeConnectService.transferToMentor(currentUser, request.amount(), entry);
        } catch (Exception e) {
            // Stripe not configured or transfer failed — mark as failed but
            // keep the ledger entry so the withdrawal is still recorded.
            entry.setPayoutStatus(PayoutStatus.FAILED);
            ledgerRepository.save(entry);
            throw new IllegalStateException("Payout transfer failed: " + e.getMessage(), e);
        }

        return entry;
    }

/**
 * Immutable data carrier for withdraw request.
 */
    public record WithdrawRequest(
            BigDecimal amount,
            String description,
            String paymentMethod) {
    }

/**
 * Immutable data carrier for wallet balance.
 */
    public record WalletBalance(BigDecimal balance, String currency) {
    }

/**
 * Immutable data carrier for wallet entry request.
 */
    public record WalletEntryRequest(
            WalletTransactionType type,
            BigDecimal amount,
            String currency,
            String description,
            String referenceType,
            Long referenceId) {
    }
}
