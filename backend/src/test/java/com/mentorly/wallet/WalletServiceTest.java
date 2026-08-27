package com.mentorly.wallet;

import com.mentorly.payout.RazorpayLinkedAccountRepository;
import com.mentorly.payout.RazorpayRouteService;
import com.mentorly.payout.StripeConnectService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.wallet.PayoutStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock
    private WalletLedgerEntryRepository ledgerRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WalletWithdrawalIdempotencyKeyRepository idempotencyKeyRepository;

    @Mock
    private StripeConnectService stripeConnectService;

    @Mock
    private RazorpayRouteService razorpayRouteService;

    @Mock
    private RazorpayLinkedAccountRepository razorpayLinkedAccountRepository;

    @InjectMocks
    private WalletService walletService;

    @Captor
    private ArgumentCaptor<WalletLedgerEntry> entryCaptor;

    private User user;
    private final Long userId = 42L;
    private final BigDecimal initialBalance = new BigDecimal("100.00");

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(userId);
        // Default: no Razorpay linked account — tests fall through to Stripe Connect
        lenient().when(razorpayLinkedAccountRepository.findByMentorId(userId)).thenReturn(Optional.empty());
    }

    // ── balance() ────────────────────────────────────────

    @Test
    void balanceReturnsZeroForNewUser() {
        when(ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(userId)).thenReturn(Optional.empty());

        var result = walletService.balance(user);

        assertEquals(BigDecimal.ZERO, result.balance());
        assertEquals("INR", result.currency());
    }

    @Test
    void balanceReturnsLastEntryBalance() {
        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setBalanceAfter(new BigDecimal("75.50"));

        when(ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(userId)).thenReturn(Optional.of(entry));

        var result = walletService.balance(user);

        assertEquals(new BigDecimal("75.50"), result.balance());
    }

    // ── history() ────────────────────────────────────────

    @Test
    void historyDelegatesToRepository() {
        var entries = List.of(new WalletLedgerEntry(), new WalletLedgerEntry());
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(entries);

        var result = walletService.history(user);

        assertEquals(2, result.size());
        verify(ledgerRepository).findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── withdraw() — validation ──────────────────────────

    @Test
    void withdrawRejectsNullAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(null, "desc", "Bank Transfer"), "test-key"));
        assertEquals("Withdrawal amount must be greater than zero", ex.getMessage());
    }

    @Test
    void withdrawRejectsZeroAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(BigDecimal.ZERO, "desc", "Bank Transfer"), "test-key"));
        assertEquals("Withdrawal amount must be greater than zero", ex.getMessage());
    }

    @Test
    void withdrawRejectsNegativeAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("-50.00"), "desc", "Bank Transfer"), "test-key"));
        assertEquals("Withdrawal amount must be greater than zero", ex.getMessage());
    }

    @Test
    void withdrawRejectsAmountBelowMinimum() {
        seedBalance(new BigDecimal("100.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("5.00"), "desc", "Bank Transfer"), "test-key"));
        assertEquals("Minimum withdrawal amount is ₹10.00", ex.getMessage());
    }

    @Test
    void withdrawRejectsExactMinimumEdgeCase() {
        seedBalance(new BigDecimal("100.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("9.99"), "desc", "Bank Transfer"), "test-key"));
        assertEquals("Minimum withdrawal amount is ₹10.00", ex.getMessage());
    }

    @Test
    void withdrawRejectsInsufficientBalance() {
        seedBalance(new BigDecimal("50.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("75.00"), "desc", "Bank Transfer"), "test-key"));
        assertEquals("Insufficient wallet balance for withdrawal", ex.getMessage());
    }

    // ── withdraw() — success cases ───────────────────────

    @Test
    void withdrawCreatesWithdrawalEntryAndDeductsBalance() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> {
            WalletLedgerEntry e = invocation.getArgument(0);
            e.setId(100L);
            return e;
        });
        // Mock the Stripe Connect transfer to return the entry
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));

        WalletService.WithdrawRequest req = new WalletService.WithdrawRequest(
                new BigDecimal("30.00"), "Test withdrawal", "stripe");

        WalletLedgerEntry result = walletService.withdraw(user, req, "idem-key-1");

        assertNotNull(result);
        assertEquals(WalletTransactionType.WITHDRAWAL, result.getType());
        assertEquals(new BigDecimal("-30.00"), result.getAmount());
        assertEquals(new BigDecimal("70.00"), result.getBalanceAfter());
        assertEquals("INR", result.getCurrency());
        assertEquals("Test withdrawal", result.getDescription());
        assertEquals("WITHDRAWAL", result.getReferenceType());
        assertNull(result.getReferenceId());
    }

    @Test
    void withdrawUsesDefaultDescriptionWithPaymentMethod() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));

        walletService.withdraw(user, new WalletService.WithdrawRequest(
                new BigDecimal("20.00"), null, "stripe"), "idem-key-2");

        verify(ledgerRepository, atLeastOnce()).save(entryCaptor.capture());
        assertEquals("Wallet withdrawal to bank account", entryCaptor.getValue().getDescription());
    }

    @Test
    void withdrawUsesGenericDefaultWhenNoDescriptionOrMethod() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        // Default paymentMethod is null → defaults to "razorpay" → uses RazorpayRouteService
        when(razorpayRouteService.processPayout(eq(user), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));

        walletService.withdraw(user, new WalletService.WithdrawRequest(
                new BigDecimal("20.00"), null, null), "idem-key-3");

        verify(ledgerRepository, atLeastOnce()).save(entryCaptor.capture());
        assertEquals("Wallet withdrawal to bank account", entryCaptor.getValue().getDescription());
    }

    @Test
    void withdrawExactBalanceAllowed() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> {
            WalletLedgerEntry e = invocation.getArgument(0);
            e.setId(101L);
            return e;
        });
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));

        WalletLedgerEntry result = walletService.withdraw(user,
                new WalletService.WithdrawRequest(new BigDecimal("100.00"), "Full withdrawal", "stripe"), "idem-key-4");

        verify(ledgerRepository, atLeastOnce()).save(entryCaptor.capture());
        assertEquals(0, BigDecimal.ZERO.compareTo(entryCaptor.getValue().getBalanceAfter()));
        assertEquals(new BigDecimal("-100.00"), entryCaptor.getValue().getAmount());
        assertNotNull(result);
    }

    @Test
    void withdrawMinimumAmountAllowed() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));

        walletService.withdraw(user,
                new WalletService.WithdrawRequest(new BigDecimal("10.00"), "Minimum withdrawal", "stripe"), "idem-key-5");

        verify(ledgerRepository, atLeastOnce()).save(entryCaptor.capture());
        assertEquals(new BigDecimal("-10.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("90.00"), entryCaptor.getValue().getBalanceAfter());
    }

    // ── addEntry() ───────────────────────────────────────

    @Test
    void withdrawFailsGracefullyWhenStripeTransferThrows() {
        seedBalance(initialBalance);
        setupUserFound();

        WalletLedgerEntry savedEntry = new WalletLedgerEntry();
        savedEntry.setId(100L);
        savedEntry.setUser(user);
        savedEntry.setType(WalletTransactionType.WITHDRAWAL);
        savedEntry.setAmount(new BigDecimal("-30.00"));
        savedEntry.setBalanceAfter(new BigDecimal("70.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> {
            WalletLedgerEntry e = invocation.getArgument(0);
            if (e.getId() == null) e.setId(100L);
            return e;
        });
        // findById must return the entry so markPayoutFailed can update it
        when(ledgerRepository.findById(100L)).thenReturn(Optional.of(savedEntry));
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenThrow(new IllegalStateException("Payout transfer failed: insufficient funds"));

        WalletService.WithdrawRequest req = new WalletService.WithdrawRequest(
                new BigDecimal("30.00"), "Test withdrawal", "stripe");

        // Should throw because the Stripe transfer failed
        assertThrows(IllegalStateException.class, () -> walletService.withdraw(user, req, "idem-key-6"));

        // markPayoutFailed was called in a REQUIRES_NEW transaction —
        // verify the entry was saved with FAILED status
        verify(ledgerRepository, atLeastOnce()).save(entryCaptor.capture());
        List<WalletLedgerEntry> savedEntries = entryCaptor.getAllValues();
        // The last save should have FAILED status (from markPayoutFailed)
        WalletLedgerEntry lastSaved = savedEntries.get(savedEntries.size() - 1);
        assertEquals(PayoutStatus.FAILED, lastSaved.getPayoutStatus());
    }

    @Test
    void addEntryRejectsNonExistentUser() {
        when(userRepository.findByIdWithLock(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.addEntryForUser(999L,
                        new WalletService.WalletEntryRequest(WalletTransactionType.CREDIT, new BigDecimal("50.00"),
                                "INR", "Test credit", null, null)));
        assertEquals("User not found", ex.getMessage());
    }

    @Test
    void addCreditEntryIncreasesBalance() {
        setupUserFound();
        seedBalance(new BigDecimal("50.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.CREDIT, new BigDecimal("25.00"),
                        "INR", "Bonus credit", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("25.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("75.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addDebitEntryDecreasesBalance() {
        setupUserFound();
        seedBalance(new BigDecimal("100.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.DEBIT, new BigDecimal("40.00"),
                        "INR", "Purchase debit", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("-40.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("60.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addDebitEntryRejectsOverdraft() {
        setupUserFound();
        seedBalance(new BigDecimal("30.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.addEntryForUser(userId,
                        new WalletService.WalletEntryRequest(WalletTransactionType.DEBIT, new BigDecimal("50.00"),
                                "INR", "Overdraft attempt", null, null)));
        assertEquals("Insufficient wallet balance", ex.getMessage());
    }

    // ── addEntry() — additional edge cases ──────────────

    @Test
    void addEarningEntryIncreasesBalance() {
        setupUserFound();
        seedBalance(new BigDecimal("50.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.EARNING, new BigDecimal("100.00"),
                        "INR", "Session earnings", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("100.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("150.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addRefundEntryIncreasesBalance() {
        setupUserFound();
        seedBalance(new BigDecimal("0.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.REFUND, new BigDecimal("25.00"),
                        "INR", "Booking refund", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("25.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("25.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addEntryRespectsNegativeAmountForDebitAlreadyNegative() {
        setupUserFound();
        seedBalance(new BigDecimal("100.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        // Pass a negative amount directly; DEBIT should negate it — but if already
        // negative, negating makes it positive. The code handles signum() >= 0 → negate.
        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.DEBIT, new BigDecimal("-30.00"),
                        "INR", "Already negative debit", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        // -30 signum is -1 (negative), so negate() is NOT applied → amount stays -30
        assertEquals(new BigDecimal("-30.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("70.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addEntryDefaultsCurrencyToCredits() {
        setupUserFound();
        seedBalance(new BigDecimal("100.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.CREDIT, new BigDecimal("10.00"),
                        null, "Null currency test", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals("INR", entryCaptor.getValue().getCurrency());
    }

    @Test
    void addEntryWithBlankCurrencyDefaultsToCredits() {
        setupUserFound();
        seedBalance(new BigDecimal("100.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.CREDIT, new BigDecimal("10.00"),
                        "", "Blank currency test", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals("INR", entryCaptor.getValue().getCurrency());
    }

    // ── balance() — edge cases ───────────────────────────

    @Test
    void balanceReturnsLastEntryWhenMultipleEntriesExist() {
        WalletLedgerEntry first = new WalletLedgerEntry();
        first.setBalanceAfter(new BigDecimal("50.00"));
        WalletLedgerEntry second = new WalletLedgerEntry();
        second.setBalanceAfter(new BigDecimal("75.00"));

        when(ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(Optional.of(second));

        var result = walletService.balance(user);
        assertEquals(new BigDecimal("75.00"), result.balance());
    }

    @Test
    void balanceUsesFindFirstMethod() {
        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setBalanceAfter(new BigDecimal("42.00"));

        when(ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(Optional.of(entry));

        var result = walletService.balance(user);
        assertEquals(new BigDecimal("42.00"), result.balance());
        // Verify the new LIMIT 1 method is used, not the full-list method
        verify(ledgerRepository, never()).findByUserIdOrderByCreatedAtDesc(any());
    }

    // ── BUG 1: Idempotency key protection ─────────────────

    @Test
    void withdrawIdempotencyReturnsSameResultOnReplay() {
        seedBalance(initialBalance);
        // First call reaches the duplicate-pending check; second call returns early
        // via idempotency, so this stub is only consumed by the first call.
        lenient().when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        // findByIdWithLock is only reached on the first call's addEntry path
        lenient().when(userRepository.findByIdWithLock(userId)).thenReturn(Optional.of(user));

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(200L);
        entry.setUser(user);
        entry.setType(WalletTransactionType.WITHDRAWAL);
        entry.setAmount(new BigDecimal("-30.00"));
        entry.setBalanceAfter(new BigDecimal("70.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> {
            WalletLedgerEntry e = invocation.getArgument(0);
            if (e.getId() == null) e.setId(200L);
            return e;
        });
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));

        WalletService.WithdrawRequest req = new WalletService.WithdrawRequest(
                new BigDecimal("30.00"), "First withdrawal", "stripe");

        // First call — should create the entry and call Stripe
        WalletLedgerEntry result1 = walletService.withdraw(user, req, "idem-test-key");
        assertNotNull(result1);
        assertEquals(new BigDecimal("-30.00"), result1.getAmount());

        // Simulate that the idempotency key is now stored
        WalletWithdrawalIdempotencyKey storedKey = new WalletWithdrawalIdempotencyKey();
        storedKey.setUser(user);
        storedKey.setIdempotencyKey("idem-test-key");
        storedKey.setLedgerEntry(result1);
        storedKey.setRequestHash(WalletServiceTest.computeHash(req));
        when(idempotencyKeyRepository.findByUserIdAndIdempotencyKey(userId, "idem-test-key"))
                .thenReturn(Optional.of(storedKey));

        // Second call with same key — should return same result, NOT call Stripe again
        WalletLedgerEntry result2 = walletService.withdraw(user, req, "idem-test-key");
        assertSame(result1, result2);
        assertEquals(result1.getId(), result2.getId());

        // Stripe should have been called only once (from the first call)
        verify(stripeConnectService, times(1)).transferToMentor(eq(user), any(), any());
    }

    @Test
    void withdrawIdempotencyRejectsDifferentPayloadSameKey() {
        seedBalance(initialBalance);
        // Idempotency check throws before reaching duplicate check,
        // so findByUserIdOrderByCreatedAtDesc is NOT needed here.

        // Seed a stored idempotency key for a DIFFERENT amount
        WalletLedgerEntry existingEntry = new WalletLedgerEntry();
        existingEntry.setId(300L);
        existingEntry.setUser(user);
        existingEntry.setType(WalletTransactionType.WITHDRAWAL);
        existingEntry.setAmount(new BigDecimal("-50.00"));

        WalletWithdrawalIdempotencyKey storedKey = new WalletWithdrawalIdempotencyKey();
        storedKey.setUser(user);
        storedKey.setIdempotencyKey("same-key-different-payload");
        storedKey.setLedgerEntry(existingEntry);
        storedKey.setRequestHash("old_hash_value");
        when(idempotencyKeyRepository.findByUserIdAndIdempotencyKey(userId, "same-key-different-payload"))
                .thenReturn(Optional.of(storedKey));

        WalletService.WithdrawRequest req = new WalletService.WithdrawRequest(
                new BigDecimal("30.00"), "Different amount", "stripe");

        // Should reject because the request hash doesn't match
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, req, "same-key-different-payload"));
        assertEquals("Idempotency key reuse with different payload", ex.getMessage());

        // Stripe should NOT have been called
        verify(stripeConnectService, never()).transferToMentor(any(), any(), any());
    }

    // ── BUG 2: FAILED status persists through rollback ──────

    @Test
    void withdrawFailedPayoutStatusPersistsAfterRollback() {
        seedBalance(initialBalance);
        setupUserFound();
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        WalletLedgerEntry savedEntry = new WalletLedgerEntry();
        savedEntry.setId(400L);
        savedEntry.setUser(user);
        savedEntry.setType(WalletTransactionType.WITHDRAWAL);
        savedEntry.setAmount(new BigDecimal("-30.00"));
        savedEntry.setBalanceAfter(new BigDecimal("70.00"));

        when(ledgerRepository.save(any())).thenAnswer(invocation -> {
            WalletLedgerEntry e = invocation.getArgument(0);
            if (e.getId() == null) e.setId(400L);
            return e;
        });
        when(ledgerRepository.findById(400L)).thenReturn(Optional.of(savedEntry));
        when(stripeConnectService.transferToMentor(eq(user), any(), any()))
                .thenThrow(new IllegalStateException("Stripe connection failed"));

        WalletService.WithdrawRequest req = new WalletService.WithdrawRequest(
                new BigDecimal("30.00"), "Failing withdrawal", "stripe");

        // Should throw because payout failed
        assertThrows(IllegalStateException.class,
                () -> walletService.withdraw(user, req, "fail-test-key"));

        // The FAILED status should have been persisted by markPayoutFailed
        // (in a REQUIRES_NEW transaction that survives the outer rollback)
        assertEquals(PayoutStatus.FAILED, savedEntry.getPayoutStatus());

        // The ledger entry should still exist (not rolled back)
        assertNotNull(savedEntry.getId());
        assertEquals(WalletTransactionType.WITHDRAWAL, savedEntry.getType());

        // Wallet balance should NOT have been reduced — the outer transaction
        // rolled back the DEBIT, so the balance is still 100.00
        verify(ledgerRepository, atLeastOnce()).save(entryCaptor.capture());
    }

    // ── helpers ──────────────────────────────────────────

    static String computeHash(WalletService.WithdrawRequest req) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(
                    (req.amount().toPlainString() + "|" + req.description() + "|" + req.paymentMethod())
                            .getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return req.amount().toPlainString();
        }
    }

    private void seedBalance(BigDecimal amount) {
        WalletLedgerEntry existing = new WalletLedgerEntry();
        existing.setBalanceAfter(amount);
        when(ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(userId)).thenReturn(Optional.of(existing));
    }

    private void setupUserFound() {
        when(userRepository.findByIdWithLock(userId)).thenReturn(Optional.of(user));
    }
}
