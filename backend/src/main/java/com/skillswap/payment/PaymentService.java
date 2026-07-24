package com.skillswap.payment;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.common.IdempotencyKeySupport;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
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

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

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
        PaymentIdempotencyKey existingKey = checkIdempotency(currentUser.getId(), endpoint, idempotencyKey, requestHash);
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

        log.info("Payment order created: id={}, orderId={}, gateway={}, amount={}",
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

            log.warn("Payment verification failed: id={}, orderId={}, paymentGatewayId={}",
                    paymentId, payment.getOrderId(), paymentGatewayId);

            incrementCounter("payment.verification.failed");
            return saved;
        }

        payment.setPaymentId(paymentGatewayId);
        payment.setSignature(signature);
        payment.setStatus(PaymentStatus.ESCROWED);
        Payment saved = paymentRepository.save(payment);

        incrementCounter("payment.verification.success");
        log.info("Payment verified and completed: id={}, orderId={}, paymentGatewayId={}",
                paymentId, payment.getOrderId(), paymentGatewayId);

        return saved;
    }

    /**
     * Process a refund for the given payment.
     * Retries up to 3 times with exponential backoff if the refund API call fails transiently.
     */
    @Retryable(
        retryFor = Exception.class,
        noRetryFor = {IllegalArgumentException.class, IllegalStateException.class},
        backoff = @Backoff(delay = 1000, multiplier = 2.0, maxDelay = 10000)
    )
    @Transactional
    public Payment refundPayment(Long paymentId, BigDecimal amount, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));

        if (payment.getStatus() != PaymentStatus.ESCROWED) {
            throw new IllegalArgumentException("Only escrowed payments can be refunded. Current status: "
                    + payment.getStatus());
        }

        PaymentGateway gateway = resolveGateway(payment.getGateway());
        String refundId = gateway.processRefund(payment.getPaymentId(), amount, reason);

        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);

        incrementCounter("payment.refund.processed");
        log.info("Payment refunded: id={}, refundId={}, amount={}, reason={}",
                paymentId, refundId, amount, reason);

        return saved;
    }

    /**
     * Get payment history for a user.
     */
    public List<Payment> getPaymentHistory(User currentUser) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            return paymentRepository.findByFilters(null, null, null, org.springframework.data.domain.PageRequest.of(0, 1000)).getContent();
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
     * Update payment status (for admin/mentor operations like wallet escrow).
     */
    @Transactional
    public Payment updatePaymentStatus(Long paymentId, PaymentStatus newStatus) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));
        payment.setStatus(newStatus);
        Payment saved = paymentRepository.save(payment);
        incrementCounter("payment.status.transition", "from", payment.getStatus().name(), "to", newStatus.name());
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
            log.warn("Idempotency key race condition: userId={}, endpoint={}", user.getId(), endpoint);
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
