package com.mentorly.payment;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.common.IdempotencyKeySupport;
import com.mentorly.common.exception.UnauthorizedException;
import com.mentorly.notification.NotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates payment operations using the PaymentGateway strategy pattern.
 * Supports Razorpay, Stripe, and PayPal gateways.
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final Logger LOG = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final PaymentIdempotencyKeyRepository idempotencyKeyRepository;
    private final NotificationService notificationService;
    private final MeterRegistry meterRegistry;
    private final List<PaymentGateway> gateways;

    /**
     * Create a payment order/intent using the specified gateway.
     * Retries up to 3 times with exponential backoff if the gateway call fails
     * (e.g. network timeout, temporary gateway outage).
     */
    @Retryable(
        retryFor = Exception.class,
        noRetryFor = {IllegalArgumentException.class, IllegalStateException.class},
        backoff = @Backoff(delay = 1000, multiplier = 2.0, maxDelay = 10000)
    )
    @Transactional
    public Payment createPaymentOrder(User currentUser, String idempotencyKey, Long bookingId,
            BigDecimal amount, String gatewaySlug) {
        validateLearnerRole(currentUser);
        IdempotencyKeySupport.validate(idempotencyKey);

        String endpoint = "payments.intent";
        String requestHash = String.join("|",
                String.valueOf(bookingId), String.valueOf(amount), gatewaySlug);

        // Check for idempotency replay
        PaymentIdempotencyKey existingKey =
                checkIdempotency(currentUser.getId(), endpoint, idempotencyKey, requestHash);
        if (existingKey != null && existingKey.getPayment() != null) {
            incrementCounter("payment.intent.replay");
            return existingKey.getPayment();
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!currentUser.getRole().equals(UserRole.ADMIN)
                && !booking.getLearner().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("You can only pay for your own booking");
        }

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }

        PaymentGateway gateway = resolveGateway(gatewaySlug);
        String orderId = "ORDER_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();

        // Call the gateway to create an order
        Map<String, Object> gatewayResponse = gateway.createOrder(orderId, amount, "INR");

        // Build and save the payment
        Payment payment = Payment.builder()
                .orderId(orderId)
                .paymentId(null) // Will be set on callback
                .signature(null) // Will be set on callback
                .learnerId(booking.getLearner().getId())
                .mentorId(booking.getSession().getMentor().getId())
                .sessionId(booking.getSession().getId())
                .amount(amount)
                .currency("INR")
                .status(PaymentStatus.INITIATED)
                .gateway(gatewaySlug)
                .createdAt(OffsetDateTime.now())
                .build();

        Payment saved = paymentRepository.save(payment);

        // Link payment to booking
        booking.setPayment(saved);
        bookingRepository.save(booking);

        // Save idempotency key
        saveIdempotencyKey(currentUser, endpoint, idempotencyKey, requestHash, saved, existingKey);

        // Store gateway response as a transient field or return alongside
        saved.setGatewayResponse(gatewayResponse);

        incrementCounter("payment.intent.created");
        notifyPaymentUpdate(booking, "Payment initiated",
                "Payment intent created for booking #" + booking.getId());

        LOG.info("Payment order created: id={}, orderId={}, gateway={}, amount={}",
                saved.getId(), orderId, gatewaySlug, amount);

        return saved;
    }

    /**
     * Verify and complete a payment after gateway callback.
     * Retries up to 3 times with exponential backoff if signature verification
     * or gateway lookup fails transiently.
     */
    @Retryable(
        retryFor = Exception.class,
        noRetryFor = {IllegalArgumentException.class, IllegalStateException.class},
        backoff = @Backoff(delay = 500, multiplier = 2.0, maxDelay = 5000)
    )
    @Transactional
    public Payment verifyAndCompletePayment(Long paymentId, String paymentGatewayId, String signature,
            Map<String, String> extraParams) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));

        PaymentGateway gateway = resolveGateway(payment.getGateway());

        boolean verified = gateway.verifyPayment(paymentGatewayId, payment.getOrderId(), signature, extraParams);

        if (!verified) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setPaymentId(paymentGatewayId);
            payment.setSignature(signature);
            Payment saved = paymentRepository.save(payment);

            LOG.warn("Payment verification failed: id={}, orderId={}, paymentGatewayId={}",
                    paymentId, payment.getOrderId(), paymentGatewayId);

            incrementCounter("payment.verification.failed");
            return saved;
        }

        payment.setPaymentId(paymentGatewayId);
        payment.setSignature(signature);
        payment.setStatus(PaymentStatus.ESCROWED);
        Payment saved = paymentRepository.save(payment);

        incrementCounter("payment.verification.success");
        LOG.info("Payment verified and completed: id={}, orderId={}, paymentGatewayId={}",
                paymentId, payment.getOrderId(), paymentGatewayId);

        return saved;
    }

    /**
     * Process a refund for the given payment.
     * Retries up to 3 times with exponential backoff if the refund API call fails transiently.
     */
    @Retryable(
        retryFor = Exception.class,
        noRetryFor = {IllegalArgumentException.class, IllegalStateException.class, UnauthorizedException.class},
        backoff = @Backoff(delay = 1000, multiplier = 2.0, maxDelay = 10000)
    )
    @Transactional
    public Payment refundPayment(Long paymentId, BigDecimal amount, String reason, User currentUser) {
        Payment payment = paymentRepository.findByIdWithLock(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));

        // Only the learner who paid (or an admin) may refund — prevents any
        // user from refunding someone else's payment (privilege escalation).
        assertPaymentAccess(payment, currentUser);

        if (payment.getStatus() != PaymentStatus.ESCROWED) {
            throw new IllegalArgumentException("Only escrowed payments can be refunded. Current status: "
                    + payment.getStatus());
        }

        // Wallet-gateway escrow is internal money whose refund is a wallet
        // credit issued by the booking/admin flows — this standalone endpoint
        // must not silently flip the status without crediting the learner.
        if ("wallet".equalsIgnoreCase(payment.getGateway())) {
            throw new IllegalArgumentException(
                    "Wallet escrow refunds are processed through the booking cancellation flow");
        }

        // Refund amount must not exceed the original payment amount.
        if (amount.compareTo(payment.getAmount()) > 0) {
            throw new IllegalArgumentException(
                    "Refund amount cannot exceed original payment amount: " + payment.getAmount());
        }

        refundThroughGateway(payment, amount, reason);

        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);

        incrementCounter("payment.refund.processed");
        LOG.info("Payment refunded: id={}, amount={}, reason={}",
                paymentId, amount, reason);

        return saved;
    }

    /**
     * Gateway-first, idempotent refund used by booking-cancellation and admin
     * flows. The external gateway is called BEFORE the database status is
     * flipped, so the DB is never marked {@code REFUNDED} for a refund that did
     * not actually happen. The payment row is loaded with a pessimistic lock so
     * concurrent refund attempts serialize — only one ever reaches the gateway
     * (duplicate-refund prevention).
     *
     * <p>Wallet-gateway escrow is internal money held inside the platform, so
     * there is no external charge to reverse; the caller performs the wallet
     * credit and this method only flips the status. The same applies to
     * {@code INITIATED} intents that were never captured — nothing was charged,
     * so no gateway refund is issued.
     *
     * @param paymentId internal payment id
     * @param amount    amount to refund
     * @param reason    human-readable refund reason
     * @return the refunded payment
     */
    @Transactional
    public Payment refundForCancellation(Long paymentId, BigDecimal amount, String reason) {
        Payment payment = paymentRepository.findByIdWithLock(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));

        // Duplicate-refund guard — idempotent for retries and for flows that
        // reach the refund twice (e.g. booking cancel + status update).
        if (payment.getStatus() == PaymentStatus.REFUNDED) {
            LOG.info("Refund skipped — payment {} already refunded", paymentId);
            return payment;
        }
        if (payment.getStatus() != PaymentStatus.ESCROWED
                && payment.getStatus() != PaymentStatus.INITIATED) {
            throw new IllegalArgumentException(
                    "Only escrowed or initiated payments can be refunded. Current status: "
                            + payment.getStatus());
        }

        // Refund amount must not exceed the original payment amount.
        if (amount.compareTo(payment.getAmount()) > 0) {
            throw new IllegalArgumentException(
                    "Refund amount cannot exceed original payment amount: " + payment.getAmount());
        }

        refundThroughGateway(payment, amount, reason);

        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);
        incrementCounter("payment.refund.processed");
        return saved;
    }

    /**
     * Issues the refund at the external gateway (if one exists for this
     * payment). Wallet-gateway escrow and never-captured {@code INITIATED}
     * intents have no external charge, so they are skipped — the money either
     * stays inside the platform wallet (credited by the caller) or was never
     * moved. A gateway failure propagates, rolling back the surrounding
     * transaction so the DB status stays unchanged.
     */
    private void refundThroughGateway(Payment payment, BigDecimal amount, String reason) {
        boolean walletEscrow = "wallet".equalsIgnoreCase(payment.getGateway());
        if (walletEscrow || payment.getStatus() != PaymentStatus.ESCROWED) {
            LOG.info("Internal refund (wallet escrow or uncaptured intent): id={}, gateway={}, status={}",
                    payment.getId(), payment.getGateway(), payment.getStatus());
            return;
        }
        if (payment.getPaymentId() == null || payment.getPaymentId().isBlank()) {
            throw new IllegalStateException(
                    "Cannot refund payment " + payment.getId() + ": missing gateway payment id");
        }
        PaymentGateway gateway = resolveGateway(payment.getGateway());
        String refundId = gateway.processRefund(payment.getPaymentId(), amount, reason);
        LOG.info("Payment refunded via gateway: id={}, refundId={}, amount={}, reason={}",
                payment.getId(), refundId, amount, reason);
    }

    /**
     * Enforces that the given user may perform a sensitive payment action
     * (refund / verify). Allowed actors are the learner who paid for it and
     * admins. Anyone else is rejected, mirroring the existing authorization
     * contract on {@code GET /api/v1/payments/{id}/status}. Throws
     * {@link UnauthorizedException} (HTTP 403) when access is denied, which
     * prevents IDOR and privilege escalation on payment records.
     */
    public void assertPaymentAccess(Payment payment, User currentUser) {
        assertPaymentAccess(payment, currentUser, false);
    }

    /**
     * Enforces that the given user may view the payment. Allowed actors are
     * the learner who paid, the mentor who received it (mirroring
     * {@link #getPaymentHistory}), and admins. Throws
     * {@link UnauthorizedException} (HTTP 403) when access is denied.
     */
    public void assertPaymentViewAccess(Payment payment, User currentUser) {
        assertPaymentAccess(payment, currentUser, true);
    }

    private void assertPaymentAccess(Payment payment, User currentUser, boolean allowMentorOfRecord) {
        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }
        if (payment.getLearnerId() != null && payment.getLearnerId().equals(currentUser.getId())) {
            return;
        }
        if (allowMentorOfRecord
                && payment.getMentorId() != null && payment.getMentorId().equals(currentUser.getId())) {
            return;
        }
        throw new UnauthorizedException("You do not have access to this payment");
    }

    /**
     * Returns a payment by ID, but only for users authorized to view it
     * (the learner who paid, the mentor who received it, or an admin).
     * Rejects IDOR attempts.
     */
    public Payment getPayment(Long paymentId, User currentUser) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));
        assertPaymentViewAccess(payment, currentUser);
        return payment;
    }

    /**
     * Get payment history for a user (paginated).
     */
    public Page<Payment> getPaymentHistory(User currentUser, Pageable pageable) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            return paymentRepository.findByFilters(null, null, null, pageable);
        }
        return paymentRepository.findByLearnerIdOrMentorId(currentUser.getId(), currentUser.getId(), pageable);
    }

    /**
     * Get payment history for a user (unbounded list — kept for internal callers).
     */
    public List<Payment> getPaymentHistory(User currentUser) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            return paymentRepository.findByFilters(null, null, null, PageRequest.of(0, 1000)).getContent();
        }
        return paymentRepository.findByLearnerIdOrMentorId(currentUser.getId(), currentUser.getId());
    }

    /**
     * Find payment by ID.
     */
    public Optional<Payment> findById(Long paymentId) {
        return paymentRepository.findById(paymentId);
    }

    /**
     * Update payment status. Admin-only: this is a privileged state mutation
     * that no learner or mentor may invoke — prevents privilege escalation
     * (e.g. flipping a payment to ESCROWED/RELEASED without a real gateway
     * transition).
     */
    @Transactional
    public Payment updatePaymentStatus(Long paymentId, PaymentStatus newStatus, User currentUser) {
        if (currentUser == null || currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only admins can update payment status");
        }
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));
        PaymentStatus previous = payment.getStatus();
        payment.setStatus(newStatus);
        Payment saved = paymentRepository.save(payment);
        incrementCounter("payment.status.transition", "from", previous.name(), "to", newStatus.name());
        return saved;
    }

    // --- Private helpers ---

    public PaymentGateway resolveGateway(String gatewaySlug) {
        return gateways.stream()
                .filter(g -> g.getGatewaySlug().equalsIgnoreCase(gatewaySlug))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported payment gateway: " + gatewaySlug));
    }

    private void validateLearnerRole(User currentUser) {
        if (currentUser.getRole() != UserRole.LEARNER && currentUser.getRole() != UserRole.ADMIN) {
            incrementCounter("payment.authz.denied", "action", "create_intent");
            throw new IllegalArgumentException("Only learners can create payment intents");
        }
    }

    private PaymentIdempotencyKey checkIdempotency(Long userId, String endpoint, String idempotencyKey,
            String requestHash) {
        var existingKey = idempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                userId, endpoint, idempotencyKey);
        if (existingKey.isPresent()) {
            PaymentIdempotencyKey key = existingKey.get();
            if (!key.getRequestHash().equals(requestHash)) {
                throw new IllegalArgumentException("Idempotency key reuse with different payload");
            }
            return key;
        }
        return null;
    }

    private void saveIdempotencyKey(User user, String endpoint, String idempotencyKey,
            String requestHash, Payment payment, PaymentIdempotencyKey existingKey) {
        try {
            PaymentIdempotencyKey key = existingKey != null ? existingKey : new PaymentIdempotencyKey();
            key.setUser(user);
            key.setEndpoint(endpoint);
            key.setIdempotencyKey(idempotencyKey);
            key.setRequestHash(requestHash);
            key.setPayment(payment);
            idempotencyKeyRepository.save(key);
        } catch (DataIntegrityViolationException ex) {
            LOG.warn("Idempotency key race condition: userId={}, endpoint={}", user.getId(), endpoint);
        }
    }

    private void notifyPaymentUpdate(Booking booking, String title, String body) {
        notificationService.notifyUser(booking.getLearner().getId(), "PAYMENT_UPDATE", title, body, booking.getId());
        notificationService.notifyUser(booking.getSession().getMentor().getId(), "PAYMENT_UPDATE", title, body,
                booking.getId());
    }

    private void incrementCounter(String name, String... tags) {
        try {
            meterRegistry.counter(name, tags).increment();
        } catch (RuntimeException ignored) {
            // No-op in tests where metrics are mocked.
        }
    }
}
