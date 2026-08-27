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
     * @param currentUser  authenticated learner
     * @param amount       top-up amount (must be >= ₹10)
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

        // Store the gateway payment ID (Stripe PaymentIntent ID or Razorpay order ID) for later verification
        Object gatewayId = gatewayResponse.get("id");
        if (gatewayId != null) {
            topUp.setGatewayPaymentId(gatewayId.toString());
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
     * @param currentUser        authenticated learner
     * @param orderId            internal order ID
     * @param gatewayPaymentId   gateway payment ID (Stripe PaymentIntent ID or Razorpay payment_id)
     * @param signature          gateway signature (Razorpay HMAC or null for Stripe)
     * @return the top-up record
     */
    @Transactional
    public WalletTopUp verifyTopUp(User currentUser, String orderId, String gatewayPaymentId, String signature) {
        WalletTopUp topUp = topUpRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Top-up not found: " + orderId));

        if (!topUp.getUser().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("You can only verify your own top-up");
        }

        // Idempotent: if already succeeded and wallet credited, return as-is
        if (topUp.getStatus() == WalletTopUpStatus.SUCCEEDED && topUp.isWalletCredited()) {
            log.info("Top-up already verified and credited: orderId={}", orderId);
            return topUp;
        }

        if (topUp.getStatus() == WalletTopUpStatus.FAILED) {
            throw new IllegalStateException("This top-up has failed and cannot be verified");
        }

        // Verify with the gateway used for this top-up
        PaymentGateway gateway = paymentService.resolveGateway(topUp.getGateway());
        boolean verified = gateway.verifyPayment(gatewayPaymentId, orderId, signature, null);

        if (!verified) {
            topUp.setStatus(WalletTopUpStatus.FAILED);
            topUpRepository.save(topUp);
            log.warn("Wallet top-up verification failed: orderId={}, gatewayPaymentId={}", orderId, gatewayPaymentId);
            throw new IllegalStateException("Payment verification failed. Please try again.");
        }

        // Payment succeeded — credit the wallet
        topUp.setStatus(WalletTopUpStatus.SUCCEEDED);
        topUp.setGatewayPaymentId(gatewayPaymentId);
        topUpRepository.save(topUp);

        if (!topUp.isWalletCredited()) {
            walletService.addEntryForUser(currentUser.getId(), new WalletService.WalletEntryRequest(
                    WalletTransactionType.CREDIT,
                    topUp.getAmount(),
                    "INR",
                    "Wallet top-up via card payment",
                    "WALLET_TOPUP",
                    topUp.getId()));
            topUp.setWalletCredited(true);
            topUpRepository.save(topUp);
            log.info("Wallet credited for top-up: userId={}, orderId={}, amount={}",
                    currentUser.getId(), orderId, topUp.getAmount());
        }

        return topUp;
    }

    /**
     * Handle Stripe webhook for a wallet top-up. Called when the webhook
     * path detects a top-up order ID prefix.
     */
    @Transactional
    public WalletTopUp handleWebhook(String orderId) {
        WalletTopUp topUp = topUpRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Top-up not found for webhook: " + orderId));

        if (topUp.getStatus() == WalletTopUpStatus.SUCCEEDED && topUp.isWalletCredited()) {
            log.info("Webhook top-up already processed: orderId={}", orderId);
            return topUp;
        }

        // Credit the wallet from the webhook path
        topUp.setStatus(WalletTopUpStatus.SUCCEEDED);
        topUpRepository.save(topUp);

        if (!topUp.isWalletCredited()) {
            walletService.addEntryForUser(topUp.getUser().getId(), new WalletService.WalletEntryRequest(
                    WalletTransactionType.CREDIT,
                    topUp.getAmount(),
                    "INR",
                    "Wallet top-up via card payment",
                    "WALLET_TOPUP",
                    topUp.getId()));
            topUp.setWalletCredited(true);
            topUpRepository.save(topUp);
            log.info("Webhook wallet credited: orderId={}, userId={}, amount={}",
                    orderId, topUp.getUser().getId(), topUp.getAmount());
        }

        return topUp;
    }
}
