package com.skillswap.wallet;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
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

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock
    private WalletLedgerEntryRepository ledgerRepository;

    @Mock
    private UserRepository userRepository;

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
    }

    // ── balance() ────────────────────────────────────────

    @Test
    void balanceReturnsZeroForNewUser() {
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        var result = walletService.balance(user);

        assertEquals(BigDecimal.ZERO, result.balance());
        assertEquals("CREDITS", result.currency());
    }

    @Test
    void balanceReturnsLastEntryBalance() {
        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setBalanceAfter(new BigDecimal("75.50"));

        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(entry));

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
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(null, "desc", "Bank Transfer")));
        assertEquals("Withdrawal amount must be greater than zero", ex.getMessage());
    }

    @Test
    void withdrawRejectsZeroAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(BigDecimal.ZERO, "desc", "Bank Transfer")));
        assertEquals("Withdrawal amount must be greater than zero", ex.getMessage());
    }

    @Test
    void withdrawRejectsNegativeAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("-50.00"), "desc", "Bank Transfer")));
        assertEquals("Withdrawal amount must be greater than zero", ex.getMessage());
    }

    @Test
    void withdrawRejectsAmountBelowMinimum() {
        seedBalance(new BigDecimal("100.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("5.00"), "desc", "Bank Transfer")));
        assertEquals("Minimum withdrawal amount is 10.00 credits", ex.getMessage());
    }

    @Test
    void withdrawRejectsExactMinimumEdgeCase() {
        seedBalance(new BigDecimal("100.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("9.99"), "desc", "Bank Transfer")));
        assertEquals("Minimum withdrawal amount is 10.00 credits", ex.getMessage());
    }

    @Test
    void withdrawRejectsInsufficientBalance() {
        seedBalance(new BigDecimal("50.00"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.withdraw(user, new WalletService.WithdrawRequest(new BigDecimal("75.00"), "desc", "Bank Transfer")));
        assertEquals("Insufficient wallet balance for withdrawal", ex.getMessage());
    }

    // ── withdraw() — success cases ───────────────────────

    @Test
    void withdrawCreatesWithdrawalEntryAndDeductsBalance() {
        seedBalance(initialBalance);
        setupUserFound();

        WalletLedgerEntry savedEntry = new WalletLedgerEntry();
        when(ledgerRepository.save(any())).thenAnswer(invocation -> {
            WalletLedgerEntry e = invocation.getArgument(0);
            e.setId(100L);
            return e;
        });

        WalletService.WithdrawRequest req = new WalletService.WithdrawRequest(
                new BigDecimal("30.00"), "Test withdrawal", "Bank Transfer");

        WalletLedgerEntry result = walletService.withdraw(user, req);

        assertNotNull(result);
        verify(ledgerRepository).save(entryCaptor.capture());
        WalletLedgerEntry captured = entryCaptor.getValue();

        assertEquals(WalletTransactionType.WITHDRAWAL, captured.getType());
        assertEquals(new BigDecimal("-30.00"), captured.getAmount());
        assertEquals(new BigDecimal("70.00"), captured.getBalanceAfter());
        assertEquals("CREDITS", captured.getCurrency());
        assertEquals("Test withdrawal", captured.getDescription());
        assertEquals("WITHDRAWAL", captured.getReferenceType());
        assertNull(captured.getReferenceId());
    }

    @Test
    void withdrawUsesDefaultDescriptionWithPaymentMethod() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.withdraw(user, new WalletService.WithdrawRequest(
                new BigDecimal("20.00"), null, "PayPal"));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals("Wallet withdrawal to PayPal", entryCaptor.getValue().getDescription());
    }

    @Test
    void withdrawUsesGenericDefaultWhenNoDescriptionOrMethod() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.withdraw(user, new WalletService.WithdrawRequest(
                new BigDecimal("20.00"), null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
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

        WalletLedgerEntry result = walletService.withdraw(user,
                new WalletService.WithdrawRequest(new BigDecimal("100.00"), "Full withdrawal", "UPI"));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(0, BigDecimal.ZERO.compareTo(entryCaptor.getValue().getBalanceAfter()));
        assertEquals(new BigDecimal("-100.00"), entryCaptor.getValue().getAmount());
        assertNotNull(result);
    }

    @Test
    void withdrawMinimumAmountAllowed() {
        seedBalance(initialBalance);
        setupUserFound();

        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.withdraw(user,
                new WalletService.WithdrawRequest(new BigDecimal("10.00"), "Minimum withdrawal", "Bank Transfer"));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("-10.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("90.00"), entryCaptor.getValue().getBalanceAfter());
    }

    // ── addEntry() ───────────────────────────────────────

    @Test
    void addEntryRejectsNonExistentUser() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.addEntryForUser(999L,
                        new WalletService.WalletEntryRequest(WalletTransactionType.CREDIT, new BigDecimal("50.00"),
                                "CREDITS", "Test credit", null, null)));
        assertEquals("User not found", ex.getMessage());
    }

    @Test
    void addCreditEntryIncreasesBalance() {
        setupUserFound();

        WalletLedgerEntry existing = new WalletLedgerEntry();
        existing.setBalanceAfter(new BigDecimal("50.00"));
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(existing));
        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.CREDIT, new BigDecimal("25.00"),
                        "CREDITS", "Bonus credit", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("25.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("75.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addDebitEntryDecreasesBalance() {
        setupUserFound();

        WalletLedgerEntry existing = new WalletLedgerEntry();
        existing.setBalanceAfter(new BigDecimal("100.00"));
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(existing));
        when(ledgerRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.addEntryForUser(userId,
                new WalletService.WalletEntryRequest(WalletTransactionType.DEBIT, new BigDecimal("40.00"),
                        "CREDITS", "Purchase debit", null, null));

        verify(ledgerRepository).save(entryCaptor.capture());
        assertEquals(new BigDecimal("-40.00"), entryCaptor.getValue().getAmount());
        assertEquals(new BigDecimal("60.00"), entryCaptor.getValue().getBalanceAfter());
    }

    @Test
    void addDebitEntryRejectsOverdraft() {
        setupUserFound();

        WalletLedgerEntry existing = new WalletLedgerEntry();
        existing.setBalanceAfter(new BigDecimal("30.00"));
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(existing));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> walletService.addEntryForUser(userId,
                        new WalletService.WalletEntryRequest(WalletTransactionType.DEBIT, new BigDecimal("50.00"),
                                "CREDITS", "Overdraft attempt", null, null)));
        assertEquals("Insufficient wallet balance", ex.getMessage());
    }

    // ── helpers ──────────────────────────────────────────

    private void seedBalance(BigDecimal amount) {
        WalletLedgerEntry existing = new WalletLedgerEntry();
        existing.setBalanceAfter(amount);
        when(ledgerRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(existing));
    }

    private void setupUserFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    }
}
