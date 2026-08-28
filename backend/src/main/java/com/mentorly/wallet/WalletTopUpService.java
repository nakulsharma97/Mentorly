package com.mentorly.wallet;

import com.mentorly.common.IdempotencyKeySupport;
import com.mentorly.payment.PaymentGateway;
import com.mentorly.payment.PaymentService;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Handles wallet top-up operations: creating Stripe PaymentIntents for
 * real-money top-ups, verifying payment success, and crediting the wallet.
 * <p>
 * Uses the existing {@link PaymentGateway} (Stripe) adapter — no new Stripe
 * integration code is written here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WalletTopUpService {

    private static final BigDecimal MIN_TOPUP_AMOUNT = new BigDecimal("10.00");

    private final WalletTopUpRepository topUpRepository;
    private final WalletService walletService;
    private final PaymentService paymentService;

    /**
     * Create a Stripe PaymentIntent for a wallet top-up.
     *
     * @param currentUser authenticated learner
     * @param amount      top-up amount (must be >= ₹10)
     * @return the top-up record with Stripe client_secret for frontend
     */
    @Transactional
    public WalletTopUp createTopUpIntent(User currentUser, BigDecimal amount, String gatewaySlug) {
        if (currentUser.getRole() != UserRole.LEARNER && currentUser.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only learners can top up their wallet");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
        if (amount.compareTo(MIN_TOPUP_AMOUNT) < 0) {
            throw new IllegalArgumentException("Minimum top-up amount is ₹" + MIN_TOPUP_AMOUNT);
        }
        if (gatewaySlug == null || gatewaySlug.isBlank()) {
            gatewaySlug = "stripe";
        }

        String orderId = "TOPUP_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();

        PaymentGateway gateway = paymentService.resolveGateway(gatewaySlug);
        Map<String, Object> gatewayResponse = gateway.createOrder(orderId, amount, "INR");

        WalletTopUp topUp = WalletTopUp.builder()
                .user(currentUser)
                .orderId(orderId)
                .amount(amount)
                .currency("INR")
                .status(WalletTopUpStatus.INITIATED)
                .walletCredited(false)
                .gateway(gatewaySlug)
                .build();
        topUp.setGatewayResponse(gatewayResponse);

        // Store gateway identifiers for later verification.
        // For Razorpay: gatewayResponse.get("id") is the Razorpay order ID (order_xxx).
        // gatewayOrderId = order_xxx, gatewayPaymentId = null (payment ID comes
        // AFTER checkout completes — the frontend sends pay_xxx + signature).
        // For Stripe: gatewayResponse.get("id") is the PaymentIntent ID (pi_xxx).
        // gatewayOrderId = pi_xxx, gatewayPaymentId = pi_xxx (same value for Stripe).
        Object gatewayId = gatewayResponse.get("id");
        if (gatewayId != null) {
            topUp.setGatewayOrderId(gatewayId.toString());
            if ("stripe".equalsIgnoreCase(gatewaySlug)) {
                topUp.setGatewayPaymentId(gatewayId.toString());
            }
            // For Razorpay: gatewayPaymentId stays null — populated later
            // from Razorpay Checkout response (pay_xxx) during /verify or webhook.
        }

        WalletTopUp saved = topUpRepository.save(topUp);
        log.info("Wallet top-up intent created: userId={}, orderId={}, gatewayPaymentId={}, amount={}",
                currentUser.getId(), orderId, topUp.getGatewayPaymentId(), amount);
        return saved;
    }

    /**
     * Verify a wallet top-up payment and credit the wallet on success.
     * Idempotent: if already credited, returns the existing record.
     *
     * @param currentUser      authenticated learner
     * @param orderId          internal order ID
     * @param gatewayPaymentId gateway payment ID (Stripe PaymentIntent ID or
     *                         Razorpay payment_id)
     * @param signature        gateway signature (Razorpay HMAC or null for Stripe)
     * @return the top-up record
     */
    @Transactional
    public WalletTopUp verifyTopUp(User currentUser, String orderId, String gatewayPaymentId, String signature) {
       WalletTopUp topUp = topUpRepository.findByOrderId(orderId)
        .orElseThrow(() -> new IllegalArgumentException("Top-up not found: " + orderId));

// Re-load the row with a database lock before processing.
// This prevents /verify and webhook from crediting the same top-up concurrently.
topUp = topUpRepository.findByIdWithLock(topUp.getId())
        .orElseThrow(() -> new IllegalArgumentException("Top-up not found: " + orderId));

        if (!topUp.getUser().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("You can only verify your own top-up");
        }

        // Idempotent: if already succeeded and wallet credited, return as-is
        if (topUp.getStatus() == WalletTopUpStatus.SUCCEEDED && topUp.isWalletCredited()) {
            log.info("Top-up already verified and credited: orderId={}", orderId);
            return topUp;
        }

        // Also handle VERIFIED state (gateway confirmed, wallet not yet credited)
        if (topUp.getStatus() == WalletTopUpStatus.VERIFIED && !topUp.isWalletCredited()) {
            // Gateway already confirmed — just credit the wallet
            creditWallet(topUp, currentUser.getId());
            return topUp;
        }

        if (topUp.getStatus() == WalletTopUpStatus.FAILED) {
            throw new IllegalStateException("This top-up has failed and cannot be verified");
        }

        // Validate that the gateway payment ID matches what we expect
        if (topUp.getGatewayPaymentId() != null && !topUp.getGatewayPaymentId().isBlank()
                && !topUp.getGatewayPaymentId().equals(gatewayPaymentId)) {
            log.warn("Gateway payment ID mismatch: expected={}, got={}",
                    topUp.getGatewayPaymentId(), gatewayPaymentId);
            throw new IllegalArgumentException("Payment ID does not match this top-up");
        }

        // Verify with the gateway used for this top-up.
        // Razorpay HMAC = HMAC(order_id + "|" + payment_id, key_secret) where order_id
        // is the REAL Razorpay order ID (e.g. order_xxx), NOT the internal TOPUP_xxx
        // id.
        // Verify using the REAL gateway order ID.
        // Never fall back to the internal Mentorly TOPUP_xxx ID.
        String orderIdForVerification = topUp.getGatewayOrderId();

        if (orderIdForVerification == null || orderIdForVerification.isBlank()) {
            throw new IllegalStateException(
                    "Gateway order ID is missing for top-up verification");
        }

        PaymentGateway gateway = paymentService.resolveGateway(topUp.getGateway());

        boolean verified = gateway.verifyPayment(
                gatewayPaymentId,
                orderIdForVerification,
                signature,
                null);
        if (!verified) {
            topUp.setStatus(WalletTopUpStatus.FAILED);
            topUpRepository.save(topUp);
            log.warn("Wallet top-up verification failed: orderId={}, gatewayPaymentId={}", orderId, gatewayPaymentId);
            throw new IllegalStateException("Payment verification failed. Please try again.");
        }

        // Payment verified by gateway — mark as VERIFIED and credit the wallet
        topUp.setStatus(WalletTopUpStatus.VERIFIED);
        topUp.setGatewayPaymentId(gatewayPaymentId);
        topUpRepository.save(topUp);

        creditWallet(topUp, currentUser.getId());

        return topUp;
    }

    /**
     * Handle webhook for a wallet top-up. Called when the webhook path detects
     * a top-up order ID prefix. Validates the payment belongs to the correct
     * internal top-up before crediting.
     */
    @Transactional
    public WalletTopUp handleWebhook(
            String orderId,
            String gatewayOrderId,
            String gatewayPaymentId,
            BigDecimal gatewayAmount) {

        WalletTopUp topUp = topUpRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Top-up not found for webhook: " + orderId));

        // Already credited -> do nothing.
        if (topUp.getStatus() == WalletTopUpStatus.SUCCEEDED
                && topUp.isWalletCredited()) {

            log.info(
                    "Webhook top-up already processed: orderId={}",
                    orderId);

            return topUp;
        }

        // A gateway payment ID must be present.
        if (gatewayPaymentId == null || gatewayPaymentId.isBlank()) {
            throw new IllegalArgumentException(
                    "Gateway payment ID is missing");
        }
        if ("razorpay".equalsIgnoreCase(topUp.getGateway())) {

            String expectedGatewayOrderId = topUp.getGatewayOrderId();

            if (expectedGatewayOrderId == null
                    || expectedGatewayOrderId.isBlank()) {
                throw new IllegalStateException(
                        "Gateway order ID is missing for Razorpay top-up");
            }

            if (gatewayOrderId == null
                    || !expectedGatewayOrderId.equals(gatewayOrderId)) {

                throw new IllegalArgumentException(
                        "Razorpay order ID does not match this top-up");
            }

            PaymentGateway gateway = paymentService.resolveGateway(topUp.getGateway());

            String gatewayStatus = gateway.fetchPaymentStatus(gatewayPaymentId);

            if (gatewayStatus == null
                    || !("captured".equalsIgnoreCase(gatewayStatus)
                            || "completed".equalsIgnoreCase(gatewayStatus))) {

                log.warn(
                        "Razorpay top-up webhook payment is not successful: "
                                + "paymentId={}, status={}",
                        gatewayPaymentId,
                        gatewayStatus);

                return topUp;
            }
        }
        // For Razorpay, make sure the webhook payment matches
        // the order that created this top-up.
        

        // Validate amount.
        if (gatewayAmount != null
                && topUp.getAmount().compareTo(gatewayAmount) != 0) {

            log.warn(
                    "Webhook amount mismatch: top-up expects={}, webhook sent={}",
                    topUp.getAmount(),
                    gatewayAmount);

            topUp.setStatus(WalletTopUpStatus.FAILED);
            topUpRepository.save(topUp);

            return topUp;
        }

        // Store the real gateway payment ID.
        topUp.setGatewayPaymentId(gatewayPaymentId);

        // Mark gateway confirmation.
        topUp.setStatus(WalletTopUpStatus.VERIFIED);

        topUpRepository.save(topUp);

        // Credit wallet exactly once.
        creditWallet(
                topUp,
                topUp.getUser().getId());

        log.info(
                "Webhook wallet credited: orderId={}, userId={}, amount={}",
                orderId,
                topUp.getUser().getId(),
                topUp.getAmount());

        return topUp;
    }

    /**
     * Credit the wallet for a verified top-up. Idempotent — only credits once.
     */
    private void creditWallet(WalletTopUp topUp, Long userId) {
        if (topUp.isWalletCredited()) {
            log.info("Wallet already credited for top-up: orderId={}", topUp.getOrderId());
            return;
        }
        walletService.addEntryForUser(userId, new WalletService.WalletEntryRequest(
                WalletTransactionType.CREDIT,
                topUp.getAmount(),
                "INR",
                "Wallet top-up via card payment",
                "WALLET_TOPUP",
                topUp.getId()));
        topUp.setWalletCredited(true);
        topUpRepository.save(topUp);
        log.info("Wallet credited for top-up: userId={}, orderId={}, amount={}",
                userId, topUp.getOrderId(), topUp.getAmount());
    }
}
