package com.mentorly.wallet;

import com.mentorly.payout.RazorpayLinkedAccountRepository;
import com.mentorly.payout.RazorpayRouteService;
import com.mentorly.payout.StripeConnectService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Service implementing wallet business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private static final Logger LOG = LoggerFactory.getLogger(WalletService.class);

    private final WalletLedgerEntryRepository ledgerRepository;
    private final UserRepository userRepository;
    private final WalletWithdrawalIdempotencyKeyRepository idempotencyKeyRepository;
    @Lazy
    private final StripeConnectService stripeConnectService;
    @Lazy
    private final RazorpayRouteService razorpayRouteService;
    private final RazorpayLinkedAccountRepository razorpayLinkedAccountRepository;

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

    /**
     * Withdraw funds from the user's wallet balance.
     * Uses idempotency-key protection to prevent duplicate Stripe transfers.
     * Failed payout status is persisted via a nested REQUIRES_NEW transaction
     * so it survives the outer rollback on failure.
     */
    @Transactional
    public WalletLedgerEntry withdraw(User currentUser, WithdrawRequest request, String idempotencyKey) {
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be greater than zero");
        }

        if (request.amount().compareTo(balance(currentUser).balance()) > 0) {
            throw new IllegalArgumentException("Insufficient wallet balance for withdrawal");
        }

        if (request.amount().compareTo(new BigDecimal("10.00")) < 0) {
            throw new IllegalArgumentException("Minimum withdrawal amount is ₹10.00");
        }

        // Idempotency: if this exact key was already used, return the original result.
        // This MUST be checked before the duplicate-pending check, because a replayed
        // idempotency key will look like a duplicate pending withdrawal to the check below.
        String requestHash = computeRequestHash(request);
        WalletWithdrawalIdempotencyKey existingKey =
                idempotencyKeyRepository.findByUserIdAndIdempotencyKey(currentUser.getId(), idempotencyKey)
                        .orElse(null);
        if (existingKey != null && existingKey.getLedgerEntry() != null) {
            if (!existingKey.getRequestHash().equals(requestHash)) {
                throw new IllegalArgumentException("Idempotency key reuse with different payload");
            }
            log.info("Withdrawal idempotency replay: userId={}, key={}", currentUser.getId(), idempotencyKey);
            return existingKey.getLedgerEntry();
        }

        // Duplicate withdrawal protection: check for recent pending withdrawal
        // with the same amount to prevent double-click submissions
        List<WalletLedgerEntry> recentWithdrawals = ledgerRepository
                .findByUserIdOrderByCreatedAtDesc(currentUser.getId());
        boolean hasDuplicatePending = recentWithdrawals.stream()
                .limit(5)
                .anyMatch(e -> e.getType() == WalletTransactionType.WITHDRAWAL
                        && e.getPayoutStatus() == PayoutStatus.PENDING
                        && e.getAmount().abs().compareTo(request.amount()) == 0
                        && java.time.OffsetDateTime.now().minusMinutes(5).isBefore(e.getCreatedAt()));
        if (hasDuplicatePending) {
            throw new IllegalArgumentException("A withdrawal of this amount is already being processed. Please wait.");
        }

        // Create the ledger entry first (sets payout_status = PENDING), then
        // initiate the payout. If the payout fails, the entry is rolled back
        // by the transactional boundary, but the FAILED status is persisted
        // via a nested REQUIRES_NEW transaction.
        WalletLedgerEntry entry = addEntry(currentUser, new WalletEntryRequest(
                WalletTransactionType.WITHDRAWAL,
                request.amount(),
                "INR",
                request.description() != null && !request.description().isBlank()
                        ? request.description()
                        : "Wallet withdrawal to bank account",
                "WITHDRAWAL",
                null));

        // Attempt real payout — try Razorpay Route first, then Stripe Connect
        try {
            entry.setPayoutStatus(PayoutStatus.PENDING);
            entry = ledgerRepository.save(entry);

            // Check if mentor has a Razorpay Linked Account with payouts enabled
            boolean hasRazorpayAccount = razorpayLinkedAccountRepository
                    .findByMentorId(currentUser.getId())
                    .filter(a -> a.isPayoutsEnabled() && a.isActivated())
                    .isPresent();

            if (hasRazorpayAccount) {
                entry = razorpayRouteService.processPayout(currentUser, request.amount(), entry);
                LOG.info("Withdrawal routed to Razorpay: userId={}, amount={}", currentUser.getId(), request.amount());
            } else {
                entry = stripeConnectService.transferToMentor(currentUser, request.amount(), entry);
                LOG.info("Withdrawal routed to Stripe Connect: userId={}, amount={}", currentUser.getId(), request.amount());
            }
        } catch (Exception e) {
            // Payout failed — mark as failed in a REQUIRES_NEW transaction
            // so it survives the outer rollback.
            markPayoutFailed(entry.getId());
            throw new IllegalStateException("Payout transfer failed: " + e.getMessage(), e);
        }

        // Persist the idempotency key so replays return the same result.
        saveIdempotencyKey(currentUser, idempotencyKey, requestHash, entry);

        return entry;
    }

    /**
     * Mark a ledger entry's payout status as FAILED in a separate transaction.
     * This survives the outer @Transactional rollback when a Stripe transfer fails,
     * ensuring the withdrawal attempt is still recorded in the ledger.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markPayoutFailed(Long ledgerEntryId) {
        ledgerRepository.findById(ledgerEntryId).ifPresent(entry -> {
            entry.setPayoutStatus(PayoutStatus.FAILED);
            ledgerRepository.save(entry);
        });
    }

    private void saveIdempotencyKey(User user, String idempotencyKey,
            String requestHash, WalletLedgerEntry ledgerEntry) {
        try {
            WalletWithdrawalIdempotencyKey key = new WalletWithdrawalIdempotencyKey();
            key.setUser(user);
            key.setIdempotencyKey(idempotencyKey);
            key.setRequestHash(requestHash);
            key.setLedgerEntry(ledgerEntry);
            idempotencyKeyRepository.save(key);
        } catch (DataIntegrityViolationException ex) {
            log.warn("Idempotency key race condition: userId={}, key={}", user.getId(), idempotencyKey);
        }
    }

    private static String computeRequestHash(WithdrawRequest request) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(
                    (request.amount().toPlainString() + "|" + request.description() + "|" + request.paymentMethod())
                            .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return request.amount().toPlainString();
        }
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
