package com.skillswap.payout;

import com.stripe.exception.ApiException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Transfer;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.TransferCreateParams;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.wallet.PayoutStatus;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletLedgerEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link StripeConnectService}.
 * All Stripe SDK calls are mocked — no real API calls are made.
 */
@ExtendWith(MockitoExtension.class)
class StripeConnectServiceTest {

    @Mock
    private MentorConnectAccountRepository connectAccountRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private WalletLedgerEntryRepository ledgerRepository;

    @InjectMocks
    private StripeConnectService stripeConnectService;

    @Captor
    private ArgumentCaptor<MentorConnectAccount> accountCaptor;
    @Captor
    private ArgumentCaptor<WalletLedgerEntry> ledgerCaptor;

    private User mentor;
    private MentorConnectAccount existingAccount;

    @BeforeEach
    void setUp() {
        mentor = new User();
        mentor.setId(42L);
        mentor.setEmail("mentor@test.com");

        existingAccount = new MentorConnectAccount();
        existingAccount.setId(1L);
        existingAccount.setMentor(mentor);
        existingAccount.setStripeAccountId("acct_test123");
        existingAccount.setOnboardingStatus(OnboardingStatus.PENDING);
        existingAccount.setPayoutsEnabled(false);
        existingAccount.setCreatedAt(OffsetDateTime.now());
        existingAccount.setUpdatedAt(OffsetDateTime.now());

        ReflectionTestUtils.setField(stripeConnectService, "secretKey", "sk_test_fake");
        ReflectionTestUtils.setField(stripeConnectService, "connectWebhookSecret", "whsec_test_fake");
        ReflectionTestUtils.setField(stripeConnectService, "frontendBaseUrl", "http://localhost:5174");
    }

    // ── createConnectAccount ──────────────────────────

    @Test
    void createConnectAccountReturnsExistingWhenPresent() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));

        MentorConnectAccount result = stripeConnectService.createConnectAccount(mentor);

        assertEquals("acct_test123", result.getStripeAccountId());
        verify(connectAccountRepository, never()).save(any());
    }

    @Test
    void createConnectAccountCreatesNewWhenNoneExists() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.empty());
        when(connectAccountRepository.save(any())).thenAnswer(inv -> {
            MentorConnectAccount a = inv.getArgument(0);
            a.setId(10L);
            return a;
        });

        // Mock Stripe SDK static call
        try (MockedStatic<Account> accountStatic = mockStatic(Account.class)) {
            Account mockAccount = mock(Account.class);
            accountStatic.when(() -> Account.create(any(AccountCreateParams.class)))
                    .thenReturn(mockAccount);
            when(mockAccount.getId()).thenReturn("acct_new123");
            when(mockAccount.getPayoutsEnabled()).thenReturn(false);

            MentorConnectAccount result = stripeConnectService.createConnectAccount(mentor);

            assertEquals("acct_new123", result.getStripeAccountId());
            assertEquals(OnboardingStatus.PENDING, result.getOnboardingStatus());
            assertFalse(result.isPayoutsEnabled());
            verify(connectAccountRepository).save(accountCaptor.capture());
        }
    }

    @Test
    void createConnectAccountThrowsOnStripeError() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.empty());

        try (MockedStatic<Account> accountStatic = mockStatic(Account.class)) {
            accountStatic.when(() -> Account.create(any(AccountCreateParams.class)))
                    .thenThrow(new com.stripe.exception.AuthenticationException(
                            "Invalid API key", null, null, 401, null));

            assertThrows(IllegalStateException.class,
                    () -> stripeConnectService.createConnectAccount(mentor));
        }
    }

    // ── createOnboardingLink ──────────────────────────

    @Test
    void createOnboardingLinkReturnsUrl() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));

        try (MockedStatic<AccountLink> linkStatic = mockStatic(AccountLink.class)) {
            AccountLink mockLink = mock(AccountLink.class);
            linkStatic.when(() -> AccountLink.create(any(AccountLinkCreateParams.class)))
                    .thenReturn(mockLink);
            when(mockLink.getUrl()).thenReturn("https://connect.stripe.com/express/oauth/authorize?...");

            String url = stripeConnectService.createOnboardingLink(mentor);

            assertTrue(url.startsWith("https://connect.stripe.com"));
        }
    }

    // ── getAccountStatus ──────────────────────────────

    @Test
    void getAccountStatusSyncsPayoutsEnabled() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));
        when(connectAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<Account> accountStatic = mockStatic(Account.class)) {
            Account mockAccount = mock(Account.class);
            accountStatic.when(() -> Account.retrieve("acct_test123")).thenReturn(mockAccount);
            when(mockAccount.getPayoutsEnabled()).thenReturn(true);

            MentorConnectAccount result = stripeConnectService.getAccountStatus(mentor);

            assertTrue(result.isPayoutsEnabled());
            assertEquals(OnboardingStatus.COMPLETE, result.getOnboardingStatus());
        }
    }

    @Test
    void getAccountStatusReturnsLocalWhenStripeFails() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));

        try (MockedStatic<Account> accountStatic = mockStatic(Account.class)) {
            accountStatic.when(() -> Account.retrieve("acct_test123"))
                    .thenThrow(new ApiException(
                            "Network error", null, null, 500, null));

            MentorConnectAccount result = stripeConnectService.getAccountStatus(mentor);

            // Returns cached local status when Stripe fails
            assertEquals("acct_test123", result.getStripeAccountId());
        }
    }

    @Test
    void getAccountStatusThrowsWhenNoAccount() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> stripeConnectService.getAccountStatus(mentor));
    }

    // ── transferToMentor ──────────────────────────────

    @Test
    void transferToMentorCreatesStripeTransfer() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));
        existingAccount.setPayoutsEnabled(true);

        WalletLedgerEntry ledgerEntry = new WalletLedgerEntry();
        ledgerEntry.setId(100L);
        ledgerEntry.setUser(mentor);
        when(ledgerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<Transfer> transferStatic = mockStatic(Transfer.class)) {
            Transfer mockTransfer = mock(Transfer.class);
            transferStatic.when(() -> Transfer.create(any(TransferCreateParams.class)))
                    .thenReturn(mockTransfer);
            when(mockTransfer.getId()).thenReturn("tr_test_transfer_123");

            WalletLedgerEntry result = stripeConnectService.transferToMentor(
                    mentor, new BigDecimal("50.00"), ledgerEntry);

            assertEquals("tr_test_transfer_123", result.getStripeTransferId());
            assertEquals(PayoutStatus.PROCESSING, result.getPayoutStatus());
        }
    }

    @Test
    void transferToMentorRejectsWhenNoAccount() {
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.empty());

        WalletLedgerEntry ledgerEntry = new WalletLedgerEntry();
        assertThrows(IllegalArgumentException.class,
                () -> stripeConnectService.transferToMentor(mentor, BigDecimal.TEN, ledgerEntry));
    }

    @Test
    void transferToMentorRejectsWhenPayoutsDisabled() {
        existingAccount.setPayoutsEnabled(false);
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));

        WalletLedgerEntry ledgerEntry = new WalletLedgerEntry();
        assertThrows(IllegalArgumentException.class,
                () -> stripeConnectService.transferToMentor(mentor, BigDecimal.TEN, ledgerEntry));
    }

    @Test
    void transferToMentorThrowsOnStripeFailure() {
        existingAccount.setPayoutsEnabled(true);
        when(connectAccountRepository.findByMentorId(42L)).thenReturn(Optional.of(existingAccount));

        WalletLedgerEntry ledgerEntry = new WalletLedgerEntry();
        ledgerEntry.setId(100L);

        try (MockedStatic<Transfer> transferStatic = mockStatic(Transfer.class)) {
            transferStatic.when(() -> Transfer.create(any(TransferCreateParams.class)))
                    .thenThrow(new ApiException(
                            "Insufficient funds", null, null, 402, null));

            assertThrows(IllegalStateException.class,
                    () -> stripeConnectService.transferToMentor(mentor, BigDecimal.TEN, ledgerEntry));
        }
    }

    // ── Webhook handling ──────────────────────────────

    @Test
    void handleAccountUpdatedSyncsPayoutsEnabled() {
        when(connectAccountRepository.findByStripeAccountId("acct_test123"))
                .thenReturn(Optional.of(existingAccount));
        when(connectAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("id", "acct_test123");
        eventData.put("payouts_enabled", true);

        stripeConnectService.handleAccountUpdated(eventData);

        verify(connectAccountRepository).save(accountCaptor.capture());
        assertTrue(accountCaptor.getValue().isPayoutsEnabled());
        assertEquals(OnboardingStatus.COMPLETE, accountCaptor.getValue().getOnboardingStatus());
    }

    @Test
    void handleAccountUpdatedMarksRestrictedWhenRequirementsDue() {
        when(connectAccountRepository.findByStripeAccountId("acct_test123"))
                .thenReturn(Optional.of(existingAccount));
        when(connectAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("id", "acct_test123");
        eventData.put("payouts_enabled", false);
        Map<String, Object> requirements = new HashMap<>();
        requirements.put("currently_due", List.of("individual.verification.document"));
        eventData.put("requirements", requirements);

        stripeConnectService.handleAccountUpdated(eventData);

        verify(connectAccountRepository).save(accountCaptor.capture());
        assertEquals(OnboardingStatus.RESTRICTED, accountCaptor.getValue().getOnboardingStatus());
    }

    @Test
    void handleAccountUpdatedIgnoresUnknownAccount() {
        when(connectAccountRepository.findByStripeAccountId("acct_unknown"))
                .thenReturn(Optional.empty());

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("id", "acct_unknown");
        eventData.put("payouts_enabled", true);

        // Should not throw
        stripeConnectService.handleAccountUpdated(eventData);
        verify(connectAccountRepository, never()).save(any());
    }

    @Test
    void handleTransferPaidMarksEntryCompleted() {
        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(200L);
        entry.setStripeTransferId("tr_paid_123");
        entry.setPayoutStatus(PayoutStatus.PROCESSING);

        when(ledgerRepository.findAll()).thenReturn(List.of(entry));
        when(ledgerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("id", "tr_paid_123");

        stripeConnectService.handleTransferPaid(eventData);

        verify(ledgerRepository).save(ledgerCaptor.capture());
        assertEquals(PayoutStatus.COMPLETED, ledgerCaptor.getValue().getPayoutStatus());
    }

    @Test
    void handleTransferFailedMarksEntryFailedAndReversesBalance() {
        User mentorUser = new User();
        mentorUser.setId(42L);

        WalletLedgerEntry failedEntry = new WalletLedgerEntry();
        failedEntry.setId(300L);
        failedEntry.setStripeTransferId("tr_failed_456");
        failedEntry.setPayoutStatus(PayoutStatus.PROCESSING);
        failedEntry.setAmount(new BigDecimal("-50.00"));
        failedEntry.setCurrency("INR");
        failedEntry.setUser(mentorUser);

        WalletLedgerEntry lastBalance = new WalletLedgerEntry();
        lastBalance.setBalanceAfter(new BigDecimal("200.00"));

        when(ledgerRepository.findAll()).thenReturn(List.of(failedEntry));
        when(ledgerRepository.findFirstByUserIdOrderByCreatedAtDesc(42L))
                .thenReturn(Optional.of(lastBalance));
        when(ledgerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("id", "tr_failed_456");

        stripeConnectService.handleTransferFailed(eventData);

        // Should save twice: once for the FAILED status, once for the reversal credit
        verify(ledgerRepository, times(2)).save(any());
    }

    @Test
    void handleTransferFailedIgnoresUnknownTransfer() {
        when(ledgerRepository.findAll()).thenReturn(List.of());

        Map<String, Object> eventData = new HashMap<>();
        eventData.put("id", "tr_unknown");

        stripeConnectService.handleTransferFailed(eventData);
        verify(ledgerRepository, never()).save(any());
    }

    // ── Webhook signature verification ──────────────────

    @Test
    void verifyConnectWebhookSignatureRejectsNullPayload() {
        assertFalse(stripeConnectService.verifyConnectWebhookSignature(null, "sig"));
    }

    @Test
    void verifyConnectWebhookSignatureRejectsBlankSignature() {
        assertFalse(stripeConnectService.verifyConnectWebhookSignature("{}", " "));
    }

    @Test
    void verifyConnectWebhookSignatureRejectsBadSignature() {
        assertFalse(stripeConnectService.verifyConnectWebhookSignature("{}", "bad_signature"));
    }
}
