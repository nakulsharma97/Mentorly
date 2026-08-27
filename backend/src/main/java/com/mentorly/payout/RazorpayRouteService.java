package com.mentorly.payout;

import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.wallet.WalletLedgerEntry;
import com.mentorly.wallet.WalletLedgerEntryRepository;
import com.mentorly.wallet.PayoutStatus;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import jakarta.annotation.PostConstruct;
import org.json.JSONObject;
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
 * Manages Razorpay Route / Linked Account for mentor payouts.
 * Creates Linked Accounts, generates onboarding links, and processes transfers.
 */
@Service
public class RazorpayRouteService {

    private static final Logger LOG = LoggerFactory.getLogger(RazorpayRouteService.class);

    private static final String DEFAULT_KEY_PLACEHOLDER = "rzp_test_xxxxxxxxxxxx";
    private static final String DEFAULT_SECRET_PLACEHOLDER = "rzp_test_secret";

    private final RazorpayLinkedAccountRepository linkedAccountRepository;
    private final UserRepository userRepository;
    private final WalletLedgerEntryRepository ledgerRepository;

    @Value("${app.payment.razorpay.key-id:" + DEFAULT_KEY_PLACEHOLDER + "}")
    private String keyId;

    @Value("${app.payment.razorpay.key-secret:" + DEFAULT_SECRET_PLACEHOLDER + "}")
    private String keySecret;

    @Value("${app.payment.razorpay.payout-webhook-secret:rzp_test_webhook_secret}")
    private String payoutWebhookSecret;

    @Value("${app.oauth2.redirect-url:http://localhost:5174}")
    private String frontendBaseUrl;

    private RazorpayClient razorpayClient;

    public RazorpayRouteService(
            RazorpayLinkedAccountRepository linkedAccountRepository,
            UserRepository userRepository,
            WalletLedgerEntryRepository ledgerRepository) {
        this.linkedAccountRepository = linkedAccountRepository;
        this.userRepository = userRepository;
        this.ledgerRepository = ledgerRepository;
    }

    @PostConstruct
    void initRazorpayClient() {
        boolean idIsPlaceholder = keyId == null || keyId.isBlank()
                || DEFAULT_KEY_PLACEHOLDER.equals(keyId);
        boolean secretIsPlaceholder = keySecret == null || keySecret.isBlank()
                || DEFAULT_SECRET_PLACEHOLDER.equals(keySecret);

        if (!idIsPlaceholder && !secretIsPlaceholder) {
            try {
                razorpayClient = new RazorpayClient(keyId, keySecret);
                LOG.info("Razorpay Route SDK initialized successfully");
            } catch (RazorpayException e) {
                LOG.error("Failed to initialize Razorpay Route SDK", e);
            }
        } else {
            LOG.warn("⚠ Razorpay keys are placeholders — Route features will not work");
        }
    }

    /**
     * Creates a Razorpay Linked Account for the mentor and returns an onboarding URL.
     * Idempotent — returns existing account if already created.
     */
    @Transactional
    public RazorpayLinkedAccount createLinkedAccount(User mentor) {
        Optional<RazorpayLinkedAccount> existing = linkedAccountRepository.findByMentorId(mentor.getId());
        if (existing.isPresent()) {
            LOG.info("Razorpay Linked Account already exists for mentorId={}, status={}",
                    mentor.getId(), existing.get().getOnboardingStatus());
            return existing.get();
        }

        if (razorpayClient == null) {
            throw new IllegalStateException(
                    "Razorpay SDK not initialized — set real APP_PAYMENT_RAZORPAY_KEY_ID "
                            + "and APP_PAYMENT_RAZORPAY_KEY_SECRET environment variables.");
        }

        try {
            // Create a Razorpay Linked Account for the mentor
            JSONObject accountRequest = new JSONObject();
            accountRequest.put("email", mentor.getEmail());
            accountRequest.put("type", "route");       // Route-linked account for marketplace payouts
            accountRequest.put("legal_business_name", mentor.getFullName() != null ? mentor.getFullName() : mentor.getEmail());
            accountRequest.put("business_type", "individual");
            accountRequest.put("country", "IN");

            // Enable payouts for this linked account
            accountRequest.put("features", new JSONObject()
                    .put("transfer_payments", true)
                    .put("settlements", true)
                    .put("online_payments", false)
                    .put("offline_payments", false));

            com.razorpay.Account result = razorpayClient.account.create(accountRequest);
            String razorpayAccountId = result.get("id");

            RazorpayLinkedAccount linkedAccount = new RazorpayLinkedAccount();
            linkedAccount.setMentor(mentor);
            linkedAccount.setRazorpayAccountId(razorpayAccountId);
            linkedAccount.setOnboardingStatus(RazorpayOnboardingStatus.PENDING);
            linkedAccount.setPayoutsEnabled(false);
            linkedAccount.setActivated(false);
            linkedAccount.setLastSyncedAt(OffsetDateTime.now());

            linkedAccount = linkedAccountRepository.save(linkedAccount);

            LOG.info("Razorpay Linked Account created: mentorId={}, razorpayAccountId={}",
                    mentor.getId(), razorpayAccountId);

            return linkedAccount;
        } catch (RazorpayException e) {
            LOG.error("Failed to create Razorpay Linked Account for mentorId={}: {}",
                    mentor.getId(), e.getMessage(), e);
            throw new IllegalStateException("Failed to create payout account: " + e.getMessage(), e);
        }
    }

    /**
     * Generates an onboarding link for the mentor to complete their Linked Account setup.
     */
    public String createOnboardingLink(User mentor) {
        RazorpayLinkedAccount linkedAccount = createLinkedAccount(mentor);

        if (razorpayClient == null) {
            throw new IllegalStateException("Razorpay SDK not initialized");
        }

        try {
            String refreshUrl = frontendBaseUrl + "/mentor/wallet?onboarding=refresh";
            String returnUrl = frontendBaseUrl + "/mentor/wallet?onboarding=complete";

            // Generate onboarding link via Razorpay Account API
            // POST /accounts/{account_id}/onboarding
            JSONObject onboardingRequest = new JSONObject();
            onboardingRequest.put("refresh_url", refreshUrl);
            onboardingRequest.put("redirect_url", returnUrl);
            onboardingRequest.put("language", "en");

            Object onboardingResult = razorpayClient.account.post(
                    "/accounts/" + linkedAccount.getRazorpayAccountId() + "/onboarding",
                    null, onboardingRequest, null);
            String onboardingUrl = onboardingResult instanceof com.razorpay.Entity entity
                    ? entity.get("url")
                    : onboardingResult.toString();

            LOG.info("Razorpay onboarding link created: mentorId={}, accountId={}",
                    mentor.getId(), linkedAccount.getRazorpayAccountId());

            return onboardingUrl;
        } catch (RazorpayException e) {
            LOG.error("Failed to create onboarding link for mentorId={}: {}", mentor.getId(), e.getMessage(), e);
            throw new IllegalStateException("Failed to create onboarding link: " + e.getMessage(), e);
        }
    }

    /**
     * Checks the mentor's payout eligibility.
     */
    public boolean isPayoutEligible(User mentor) {
        RazorpayLinkedAccount account = linkedAccountRepository.findByMentorId(mentor.getId())
                .orElse(null);
        if (account == null) return false;
        return account.isPayoutsEnabled() && account.isActivated()
                && account.getOnboardingStatus() == RazorpayOnboardingStatus.COMPLETE;
    }

    /**
     * Processes a payout transfer from the platform to the mentor's Linked Account.
     * This creates a real Razorpay Transfer.
     */
    @Transactional
    public WalletLedgerEntry processPayout(User mentor, BigDecimal amount, WalletLedgerEntry ledgerEntry) {
        RazorpayLinkedAccount linkedAccount = linkedAccountRepository.findByMentorId(mentor.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Complete your payout account setup before withdrawing."));

        if (!linkedAccount.isPayoutsEnabled() || !linkedAccount.isActivated()) {
            throw new IllegalStateException(
                    "Payouts are not enabled on your account. Please complete onboarding first.");
        }

        if (razorpayClient == null) {
            throw new IllegalStateException("Razorpay SDK not initialized");
        }

        try {
            long amountPaise = amount.movePointRight(2).longValueExact();

            JSONObject transferRequest = new JSONObject();
            transferRequest.put("account", linkedAccount.getRazorpayAccountId());
            transferRequest.put("amount", amountPaise);
            transferRequest.put("currency", "INR");
            transferRequest.put("mode", "UPI");  // or NEFT/RTGS
            transferRequest.put("notes", new JSONObject()
                    .put("ledger_entry_id", String.valueOf(ledgerEntry.getId()))
                    .put("mentor_id", String.valueOf(mentor.getId())));

            com.razorpay.Transfer transfer = razorpayClient.transfers.create(transferRequest);
            String transferId = transfer.get("id");

            ledgerEntry.setGatewayTransferId(transferId);
            ledgerEntry.setPayoutStatus(PayoutStatus.PROCESSING);
            ledgerEntry = ledgerRepository.save(ledgerEntry);

            LOG.info("Razorpay Transfer created: transferId={}, mentorId={}, amount={}, accountId={}",
                    transferId, mentor.getId(), amount, linkedAccount.getRazorpayAccountId());

            return ledgerEntry;
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException("Amount has more than 2 decimal places: " + amount);
        } catch (RazorpayException e) {
            LOG.error("Razorpay Transfer failed for mentorId={}, amount={}: {}",
                    mentor.getId(), amount, e.getMessage(), e);
            throw new IllegalStateException("Payout transfer failed: " + e.getMessage(), e);
        }
    }

    /**
     * Handles the account.updated webhook from Razorpay to sync onboarding status.
     */
    @Transactional
    public void handleAccountUpdated(Map<String, Object> eventData) {
        String razorpayAccountId = extractString(eventData, "id");
        if (razorpayAccountId == null) {
            LOG.warn("account.updated webhook missing account ID");
            return;
        }

        linkedAccountRepository.findByRazorpayAccountId(razorpayAccountId).ifPresentOrElse(
                account -> {
                    Boolean payoutsEnabled = (Boolean) eventData.get("payouts_enabled");
                    if (payoutsEnabled != null) {
                        account.setPayoutsEnabled(payoutsEnabled);
                    }

                    if (Boolean.TRUE.equals(payoutsEnabled)) {
                        account.setOnboardingStatus(RazorpayOnboardingStatus.COMPLETE);
                        account.setActivated(true);
                    } else {
                        // Check for restrictions
                        Object requirements = eventData.get("requirements");
                        if (requirements instanceof java.util.List<?> list && !list.isEmpty()) {
                            account.setOnboardingStatus(RazorpayOnboardingStatus.RESTRICTED);
                        } else {
                            account.setOnboardingStatus(RazorpayOnboardingStatus.PENDING);
                        }
                    }

                    account.setLastSyncedAt(OffsetDateTime.now());
                    account.setUpdatedAt(OffsetDateTime.now());
                    linkedAccountRepository.save(account);

                    LOG.info("Razorpay Linked Account updated via webhook: accountId={}, payoutsEnabled={}",
                            razorpayAccountId, account.isPayoutsEnabled());
                },
                () -> LOG.warn("account.updated for unknown Razorpay account: {}", razorpayAccountId)
        );
    }

    /**
     * Handles transfer.paid webhook — marks payout as completed.
     */
    @Transactional
    public void handleTransferPaid(Map<String, Object> eventData) {
        String transferId = extractString(eventData, "id");
        if (transferId == null) return;

        ledgerRepository.findByGatewayTransferId(transferId)
                .ifPresent(entry -> {
                    if (entry.getPayoutStatus() == PayoutStatus.COMPLETED) {
                        LOG.info("Razorpay payout already completed: transferId={}", transferId);
                        return;
                    }
                    entry.setPayoutStatus(PayoutStatus.COMPLETED);
                    ledgerRepository.save(entry);
                    LOG.info("Razorpay payout completed via webhook: transferId={}, ledgerEntryId={}",
                            transferId, entry.getId());
                });
    }

    /**
     * Handles transfer.failed webhook — marks payout as failed and reverses balance.
     */
    @Transactional
    public void handleTransferFailed(Map<String, Object> eventData) {
        String transferId = extractString(eventData, "id");
        if (transferId == null) return;

        ledgerRepository.findByGatewayTransferId(transferId)
                .ifPresent(entry -> {
                    if (entry.getPayoutStatus() == PayoutStatus.COMPLETED
                            || entry.getPayoutStatus() == PayoutStatus.FAILED) {
                        LOG.info("Razorpay payout already in terminal state: transferId={}, status={}",
                                transferId, entry.getPayoutStatus());
                        return;
                    }
                    entry.setPayoutStatus(PayoutStatus.FAILED);
                    ledgerRepository.save(entry);
                    LOG.warn("Razorpay payout failed via webhook: transferId={}, ledgerEntryId={}",
                            transferId, entry.getId());

                    // Reverse the balance
                    User mentor = entry.getUser();
                    BigDecimal reversalAmount = entry.getAmount().abs();

                    BigDecimal currentBalance = ledgerRepository
                            .findFirstByUserIdOrderByCreatedAtDesc(mentor.getId())
                            .map(WalletLedgerEntry::getBalanceAfter)
                            .orElse(BigDecimal.ZERO);

                    WalletLedgerEntry credit = new WalletLedgerEntry();
                    credit.setUser(mentor);
                    credit.setType(com.mentorly.wallet.WalletTransactionType.REFUND);
                    credit.setAmount(reversalAmount);
                    credit.setBalanceAfter(currentBalance.add(reversalAmount));
                    credit.setCurrency(entry.getCurrency());
                    credit.setDescription("Reversal for failed payout (Razorpay transfer: " + transferId + ")");
                    credit.setReferenceType("PAYOUT_REVERSAL");
                    credit.setReferenceId(entry.getId());
                    ledgerRepository.save(credit);

                    LOG.info("Balance reversed for failed Razorpay payout: mentorId={}, amount={}",
                            mentor.getId(), reversalAmount);
                });
    }

    private static String extractString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val instanceof String s ? s : null;
    }

    /**
     * Verify Razorpay payout webhook signature using HMAC-SHA256.
     * Uses the dedicated payout webhook secret (separate from the payment webhook secret).
     */
    public boolean verifyWebhookSignature(String rawPayload, String signatureHeader) {
        if (rawPayload == null || signatureHeader == null || signatureHeader.isBlank()) {
            LOG.warn("Razorpay payout webhook signature header missing or empty");
            return false;
        }

        String secretForVerification = (payoutWebhookSecret != null && !payoutWebhookSecret.isBlank()
                && !"rzp_test_webhook_secret".equals(payoutWebhookSecret))
                ? payoutWebhookSecret : keySecret;

        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            javax.crypto.spec.SecretKeySpec secretKey = new javax.crypto.spec.SecretKeySpec(
                    secretForVerification.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmacBytes = mac.doFinal(rawPayload.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }

            String expectedSignature = hexString.toString();
            boolean verified = expectedSignature.equals(signatureHeader);
            LOG.info("Razorpay payout webhook signature verification: {}", verified ? "PASSED" : "FAILED");
            return verified;
        } catch (java.security.GeneralSecurityException e) {
            LOG.error("Razorpay payout webhook signature verification failed", e);
            return false;
        }
    }
}
