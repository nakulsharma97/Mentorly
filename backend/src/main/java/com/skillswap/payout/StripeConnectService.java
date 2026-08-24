package com.skillswap.payout;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Transfer;
import com.stripe.net.Webhook;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.TransferCreateParams;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletLedgerEntryRepository;
import com.skillswap.wallet.PayoutStatus;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Manages Stripe Connect Express accounts for mentors and handles
 * the Transfer API for real payouts.
 */
@Service
public class StripeConnectService {

    private static final Logger LOG = LoggerFactory.getLogger(StripeConnectService.class);

    private static final String DEFAULT_KEY_PLACEHOLDER = "sk_test_xxxxxxxxxxxx";
    private static final String DEFAULT_CONNECT_WEBHOOK_PLACEHOLDER = "whsec_test_connect_secret";

    private final MentorConnectAccountRepository connectAccountRepository;
    private final UserRepository userRepository;
    private final WalletLedgerEntryRepository ledgerRepository;

    @Value("${app.payment.stripe.secret-key:" + DEFAULT_KEY_PLACEHOLDER + "}")
    private String secretKey;

    @Value("${app.payment.stripe.connect-webhook-secret:" + DEFAULT_CONNECT_WEBHOOK_PLACEHOLDER + "}")
    private String connectWebhookSecret;

    @Value("${app.oauth2.redirect-url:http://localhost:5174}")
    private String frontendBaseUrl;

    public StripeConnectService(
            MentorConnectAccountRepository connectAccountRepository,
            UserRepository userRepository,
            WalletLedgerEntryRepository ledgerRepository) {
        this.connectAccountRepository = connectAccountRepository;
        this.userRepository = userRepository;
        this.ledgerRepository = ledgerRepository;
    }

    @PostConstruct
    void initStripeSdk() {
        boolean keyIsPlaceholder = secretKey == null || secretKey.isBlank()
                || DEFAULT_KEY_PLACEHOLDER.equals(secretKey);

        if (!keyIsPlaceholder) {
            Stripe.apiKey = secretKey;
        } else {
            LOG.warn("⚠ Stripe secret-key is a placeholder — Connect features will fail on real Stripe calls.");
        }
    }

    // ════════════════════════════════════════════════
    //  Onboarding flow
    // ════════════════════════════════════════════════

    /**
     * Creates a Stripe Connect Express account for the mentor (idempotent —
     * returns the existing one if already created).
     */
    @Transactional
    public MentorConnectAccount createConnectAccount(User mentor) {
        Optional<MentorConnectAccount> existing = connectAccountRepository.findByMentorId(mentor.getId());
        if (existing.isPresent()) {
            LOG.info("Connect account already exists for mentorId={}, status={}",
                    mentor.getId(), existing.get().getOnboardingStatus());
            return existing.get();
        }

        try {
            AccountCreateParams params = AccountCreateParams.builder()
                    .setType(AccountCreateParams.Type.EXPRESS)
                    .setCountry("IN")
                    .setEmail(mentor.getEmail())
                    .putMetadata("mentor_id", String.valueOf(mentor.getId()))
                    .setCapabilities(
                            AccountCreateParams.Capabilities.builder()
                                    .setTransfers(
                                            AccountCreateParams.Capabilities.Transfers.builder()
                                                    .setRequested(true)
                                                    .build())
                                    .build())
                    .build();

            Account account = Account.create(params);

            MentorConnectAccount connectAccount = new MentorConnectAccount();
            connectAccount.setMentor(mentor);
            connectAccount.setStripeAccountId(account.getId());
            connectAccount.setOnboardingStatus(OnboardingStatus.PENDING);
            connectAccount.setPayoutsEnabled(Boolean.TRUE.equals(account.getPayoutsEnabled()));
            connectAccount.setUpdatedAt(OffsetDateTime.now());

            connectAccount = connectAccountRepository.save(connectAccount);
            LOG.info("Stripe Connect account created: mentorId={}, stripeAccountId={}",
                    mentor.getId(), account.getId());
            return connectAccount;
        } catch (StripeException e) {
            LOG.error("Failed to create Stripe Connect account for mentorId={}", mentor.getId(), e);
            throw new IllegalStateException("Failed to create payout account: " + e.getMessage(), e);
        }
    }

    /**
     * Generates a Stripe-hosted onboarding URL for the mentor to complete
     * their Connect account setup.
     */
    public String createOnboardingLink(User mentor) {
        MentorConnectAccount connectAccount = createConnectAccount(mentor);
        String refreshUrl = frontendBaseUrl + "/mentor/wallet?onboarding=refresh";
        String returnUrl = frontendBaseUrl + "/mentor/wallet?onboarding=complete";

        try {
            AccountLinkCreateParams params = AccountLinkCreateParams.builder()
                    .setAccount(connectAccount.getStripeAccountId())
                    .setRefreshUrl(refreshUrl)
                    .setReturnUrl(returnUrl)
                    .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                    .build();

            AccountLink link = AccountLink.create(params);
            LOG.info("Onboarding link created for mentorId={}, accountId={}",
                    mentor.getId(), connectAccount.getStripeAccountId());
            return link.getUrl();
        } catch (StripeException e) {
            LOG.error("Failed to create onboarding link for mentorId={}", mentor.getId(), e);
            throw new IllegalStateException("Failed to create onboarding link: " + e.getMessage(), e);
        }
    }

    /**
     * Retrieves current onboarding status from Stripe and syncs it locally.
     * Used as a polling fallback (mirrors the existing /payments/{id}/status pattern).
     */
    @Transactional
    public MentorConnectAccount getAccountStatus(User mentor) {
        MentorConnectAccount connectAccount = connectAccountRepository.findByMentorId(mentor.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No payout account found. Please set up payouts first."));

        try {
            Account account = Account.retrieve(connectAccount.getStripeAccountId());

            // Sync Stripe's authoritative status to our local record
            if (Boolean.TRUE.equals(account.getPayoutsEnabled())) {
                connectAccount.setPayoutsEnabled(true);
                connectAccount.setOnboardingStatus(OnboardingStatus.COMPLETE);
            } else if (account.getRequirements() != null
                    && account.getRequirements().getCurrentlyDue() != null
                    && !account.getRequirements().getCurrentlyDue().isEmpty()) {
                connectAccount.setOnboardingStatus(OnboardingStatus.RESTRICTED);
            } else {
                connectAccount.setOnboardingStatus(OnboardingStatus.PENDING);
            }

            connectAccount.setUpdatedAt(OffsetDateTime.now());
            return connectAccountRepository.save(connectAccount);
        } catch (StripeException e) {
            LOG.error("Failed to retrieve Stripe account status for mentorId={}", mentor.getId(), e);
            // Return the locally cached status rather than failing
            return connectAccount;
        }
    }

    // ════════════════════════════════════════════════
    //  Transfer (real payout)
    // ════════════════════════════════════════════════

    /**
     * Transfers funds from the platform Stripe account to the mentor's
     * connected account. The ledger entry is passed in so it can be
     * annotated with the Stripe Transfer ID on success.
     *
     * @param mentor        the mentor receiving the payout
     * @param amount        payout amount in INR
     * @param ledgerEntry   the ledger entry to annotate with the transfer ID
     * @return the ledger entry (with stripeTransferId and payoutStatus set)
     */
    @Transactional
    public WalletLedgerEntry transferToMentor(User mentor, BigDecimal amount, WalletLedgerEntry ledgerEntry) {
        MentorConnectAccount connectAccount = connectAccountRepository.findByMentorId(mentor.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Complete your payout account setup before withdrawing."));

        if (!connectAccount.isPayoutsEnabled()) {
            throw new IllegalArgumentException(
                    "Payouts are not enabled on your account. Please complete onboarding first.");
        }

        try {
            long amountSmallestUnit = amount.movePointRight(2).longValueExact();

            TransferCreateParams params = TransferCreateParams.builder()
                    .setAmount(amountSmallestUnit)
                    .setCurrency("inr")
                    .setDestination(connectAccount.getStripeAccountId())
                    .putMetadata("ledger_entry_id", String.valueOf(ledgerEntry.getId()))
                    .putMetadata("mentor_id", String.valueOf(mentor.getId()))
                    .build();

            Transfer transfer = Transfer.create(params);

            ledgerEntry.setStripeTransferId(transfer.getId());
            ledgerEntry.setPayoutStatus(PayoutStatus.PROCESSING);
            ledgerEntry = ledgerRepository.save(ledgerEntry);

            LOG.info("Stripe Transfer created: transferId={}, mentorId={}, amount={}, accountId={}",
                    transfer.getId(), mentor.getId(), amount, connectAccount.getStripeAccountId());
            return ledgerEntry;
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException("Amount has more than 2 decimal places for Stripe: " + amount);
        } catch (StripeException e) {
            LOG.error("Stripe Transfer failed for mentorId={}, amount={}", mentor.getId(), amount, e);
            throw new IllegalStateException("Payout transfer failed: " + e.getMessage(), e);
        }
    }

    // ════════════════════════════════════════════════
    //  Webhook handling
    // ════════════════════════════════════════════════

    /**
     * Verify a Stripe Connect webhook signature using the Connect-specific secret.
     */
    public boolean verifyConnectWebhookSignature(String rawPayload, String signatureHeader) {
        if (rawPayload == null || rawPayload.isBlank()
                || signatureHeader == null || signatureHeader.isBlank()) {
            LOG.warn("Connect webhook payload or signature header missing");
            return false;
        }
        try {
            Webhook.constructEvent(rawPayload, signatureHeader, connectWebhookSecret);
            return true;
        } catch (SignatureVerificationException e) {
            LOG.error("Connect webhook signature verification FAILED: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            LOG.error("Connect webhook payload parsing failed", e);
            return false;
        }
    }

    /**
     * Handle the account.updated event — sync payouts_enabled and onboarding status.
     */
    @Transactional
    public void handleAccountUpdated(Map<String, Object> eventData) {
        String stripeAccountId = extractAccountId(eventData);
        if (stripeAccountId == null) {
            LOG.warn("account.updated webhook missing account ID");
            return;
        }

        connectAccountRepository.findByStripeAccountId(stripeAccountId).ifPresentOrElse(
                connectAccount -> {
                    Boolean payoutsEnabled = (Boolean) eventData.get("payouts_enabled");
                    if (payoutsEnabled != null) {
                        connectAccount.setPayoutsEnabled(payoutsEnabled);
                    }

                    if (Boolean.TRUE.equals(payoutsEnabled)) {
                        connectAccount.setOnboardingStatus(OnboardingStatus.COMPLETE);
                    } else {
                        // Check requirements to determine if restricted
                        Object requirements = eventData.get("requirements");
                        if (requirements instanceof Map<?, ?> reqMap) {
                            Object currentlyDue = reqMap.get("currently_due");
                            if (currentlyDue instanceof java.util.List<?> list && !list.isEmpty()) {
                                connectAccount.setOnboardingStatus(OnboardingStatus.RESTRICTED);
                            } else {
                                connectAccount.setOnboardingStatus(OnboardingStatus.PENDING);
                            }
                        }
                    }

                    connectAccount.setUpdatedAt(OffsetDateTime.now());
                    connectAccountRepository.save(connectAccount);
                    LOG.info("Connect account updated via webhook: accountId={}, payoutsEnabled={}",
                            stripeAccountId, connectAccount.isPayoutsEnabled());
                },
                () -> LOG.warn("account.updated for unknown account: {}", stripeAccountId)
        );
    }

    /**
     * Handle the transfer.paid event — mark payout as completed.
     */
    @Transactional
    public void handleTransferPaid(Map<String, Object> eventData) {
        String transferId = extractTransferId(eventData);
        if (transferId == null) return;

        ledgerRepository.findAll().stream()
                .filter(e -> transferId.equals(e.getStripeTransferId()))
                .findFirst()
                .ifPresent(entry -> {
                    entry.setPayoutStatus(PayoutStatus.COMPLETED);
                    ledgerRepository.save(entry);
                    LOG.info("Payout completed via webhook: transferId={}, ledgerEntryId={}",
                            transferId, entry.getId());
                });
    }

    /**
     * Handle the transfer.failed event — mark payout as failed and reverse the balance.
     */
    @Transactional
    public void handleTransferFailed(Map<String, Object> eventData) {
        String transferId = extractTransferId(eventData);
        if (transferId == null) return;

        ledgerRepository.findAll().stream()
                .filter(e -> transferId.equals(e.getStripeTransferId()))
                .findFirst()
                .ifPresent(entry -> {
                    entry.setPayoutStatus(PayoutStatus.FAILED);
                    ledgerRepository.save(entry);
                    LOG.warn("Payout failed via webhook: transferId={}, ledgerEntryId={}",
                            transferId, entry.getId());

                    // Reverse the balance: credit the withdrawn amount back
                    User mentor = entry.getUser();
                    BigDecimal reversalAmount = entry.getAmount().abs(); // amount was stored as negative
                    com.skillswap.wallet.WalletService.WalletEntryRequest reversal =
                            new com.skillswap.wallet.WalletService.WalletEntryRequest(
                                    com.skillswap.wallet.WalletTransactionType.REFUND,
                                    reversalAmount,
                                    entry.getCurrency(),
                                    "Reversal for failed payout (transfer: " + transferId + ")",
                                    "PAYOUT_REVERSAL",
                                    entry.getId());
                    // Directly use the repository to avoid circular dependency
                    // We add a credit entry for the mentor
                    com.skillswap.wallet.WalletLedgerEntry credit = new com.skillswap.wallet.WalletLedgerEntry();
                    credit.setUser(mentor);
                    credit.setType(com.skillswap.wallet.WalletTransactionType.REFUND);
                    credit.setAmount(reversalAmount);
                    // Compute new balance
                    BigDecimal currentBalance = ledgerRepository
                            .findFirstByUserIdOrderByCreatedAtDesc(mentor.getId())
                            .map(com.skillswap.wallet.WalletLedgerEntry::getBalanceAfter)
                            .orElse(BigDecimal.ZERO);
                    credit.setBalanceAfter(currentBalance.add(reversalAmount));
                    credit.setCurrency(entry.getCurrency());
                    credit.setDescription("Reversal for failed payout (transfer: " + transferId + ")");
                    credit.setReferenceType("PAYOUT_REVERSAL");
                    credit.setReferenceId(entry.getId());
                    ledgerRepository.save(credit);
                    LOG.info("Balance reversed for failed payout: mentorId={}, amount={}",
                            mentor.getId(), reversalAmount);
                });
    }

    // ── helpers ───────────────────────────────────

    private static String extractAccountId(Map<String, Object> eventData) {
        if (eventData == null) return null;
        Object id = eventData.get("id");
        return id instanceof String s ? s : null;
    }

    private static String extractTransferId(Map<String, Object> eventData) {
        if (eventData == null) return null;
        Object id = eventData.get("id");
        return id instanceof String s ? s : null;
    }
}
