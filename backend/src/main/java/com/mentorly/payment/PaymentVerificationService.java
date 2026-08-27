package com.mentorly.payment;

import com.mentorly.notification.NotificationService;
import com.mentorly.user.User;
import com.mentorly.wallet.WalletTopUpService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Handles payment verification callbacks from external payment gateways.
 * Processes webhook events and idempotency-safe payment confirmations.
 */
@Service
@RequiredArgsConstructor
public class PaymentVerificationService {

    private static final Logger LOG = LoggerFactory.getLogger(PaymentVerificationService.class);

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final NotificationService notificationService;
    @Lazy
    private final WalletTopUpService walletTopUpService;

    /**
     * Process a payment verification callback (from frontend redirect or webhook).
     *
     * @param paymentId     Internal payment ID
     * @param gatewayPaymentId  Payment ID from the gateway (e.g. Razorpay payment_id)
     * @param signature     Signature/hmac from gateway for verification
     * @param extraParams   Additional gateway-specific parameters
     * @param currentUser   Authenticated caller — must be the learner who paid
     *                      (or an admin), otherwise access is denied (IDOR
     *                      prevention).
     * @return Verified payment entity
     */
    @Transactional
    public Payment verifyPayment(Long paymentId, String gatewayPaymentId, String signature,
            Map<String, String> extraParams, User currentUser) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paymentId));
        paymentService.assertPaymentAccess(payment, currentUser);

        Payment verified = paymentService.verifyAndCompletePayment(paymentId, gatewayPaymentId, signature, extraParams);

        if (verified.getStatus() == PaymentStatus.ESCROWED) {
            notifyPaymentSuccess(verified);
            LOG.info("Payment verification callback succeeded: paymentId={}, gatewayPaymentId={}",
                    paymentId, gatewayPaymentId);
        } else {
            LOG.warn("Payment verification callback failed: paymentId={}, gatewayPaymentId={}, status={}",
                    paymentId, gatewayPaymentId, verified.getStatus());
        }

        return verified;
    }

    /**
     * Process a gateway webhook event (e.g. payment.captured, payment.failed).
     * Also handles wallet top-up webhooks by checking the orderId prefix.
     * Uses idempotent event processing to prevent duplicate side effects.
     */
    @Transactional
    public Payment processWebhookEvent(String gatewaySlug, String eventType, String gatewayPaymentId,
            Map<String, Object> eventData) {
        // Extract Razorpay event ID for deduplication
        String eventId = extractEventId(eventData, gatewaySlug);
        LOG.info("Processing webhook: gateway={}, eventType={}, gatewayPaymentId={}, eventId={}",
                gatewaySlug, eventType, gatewayPaymentId, eventId);

        // Idempotent: if we already processed this exact event, skip
        if (eventId != null && !eventId.isBlank()) {
            // Simple in-memory dedup via the processed event store
            if (processedEvents.contains(eventId)) {
                LOG.info("Duplicate webhook event ignored: eventId={}", eventId);
                return null;
            }
            processedEvents.add(eventId);
        }

        // Check if this is a wallet top-up webhook by looking for TOPUP_ prefix
        // in the metadata. Stripe webhooks carry the internal_order_id in metadata.
        // Razorpay webhooks carry it in notes.
        String orderId = extractOrderIdFromMetadata(eventData);
        if (orderId != null && orderId.startsWith("TOPUP_")) {
            try {
                walletTopUpService.handleWebhook(orderId);
                LOG.info("Webhook handled as wallet top-up: orderId={}", orderId);
            } catch (Exception e) {
                LOG.warn("Failed to process wallet top-up webhook: orderId={}", orderId, e);
            }
            return null; // Top-ups don't have a Payment record
        }

        // If no gatewayPaymentId found, try to find by order ID from Razorpay
        // Razorpay payment.captured has payment ID inside data.payment.entity.id
        if (gatewayPaymentId == null || gatewayPaymentId.isBlank()) {
            String orderIdFromPayload = extractOrderIdFromPayload(eventData);
            if (orderIdFromPayload != null) {
                Payment payment = paymentRepository.findByOrderId(orderIdFromPayload).orElse(null);
                if (payment != null) {
                    gatewayPaymentId = payment.getPaymentId();
                }
            }
        }

        if (gatewayPaymentId == null || gatewayPaymentId.isBlank()) {
            LOG.warn("Cannot extract gateway payment ID from webhook: eventType={}", eventType);
            return null;
        }

        // Find the payment by gateway payment ID
        Payment payment = paymentRepository.findByPaymentId(gatewayPaymentId)
                .orElse(null);
        if (payment == null) {
            LOG.warn("Payment not found for gateway payment ID: {} — webhook may arrive before /verify",
                    gatewayPaymentId);
            return null;
        }

        // Idempotent: don't re-process if already in a terminal state
        if (payment.getStatus() == PaymentStatus.ESCROWED
                || payment.getStatus() == PaymentStatus.COMPLETED
                || payment.getStatus() == PaymentStatus.REFUNDED) {
            LOG.info("Webhook idempotent skip: paymentId={}, status={}, eventType={}",
                    payment.getId(), payment.getStatus(), eventType);
            return payment;
        }

        switch (eventType) {
            // Razorpay payment events
            case "payment.captured":
            case "payment.authorized":
            // Stripe payment events
            case "charge.captured":
            case "payment_intent.succeeded":
            // PayPal events
            case "CHECKOUT.ORDER.APPROVED":
                if (payment.getStatus() == PaymentStatus.INITIATED) {
                    payment.setStatus(PaymentStatus.ESCROWED);
                    Payment saved = paymentRepository.save(payment);
                    notifyPaymentSuccess(saved);
                    LOG.info("Webhook payment captured: paymentId={}, eventType={}", saved.getId(), eventType);
                    return saved;
                }
                break;

            case "payment.failed":
            case "payment.expired":
            case "charge.failed":
            case "payment_intent.payment_failed":
            case "CHECKOUT.ORDER.DECLINED":
                payment.setStatus(PaymentStatus.FAILED);
                Payment saved = paymentRepository.save(payment);
                LOG.warn("Webhook payment failed: paymentId={}, eventType={}", saved.getId(), eventType);
                return saved;

            default:
                LOG.info("Unhandled webhook event type: {} for gateway {}", eventType, gatewaySlug);
        }

        return payment;
    }

    /**
     * Extract event ID for deduplication.
     * - Razorpay: top-level "id" field (e.g. evt_xxx) or X-Razorpay-Event-Id header
     * - Stripe: top-level "id" field (e.g. evt_xxx)
     */
    private String extractEventId(Map<String, Object> eventData, String gatewaySlug) {
        Object idObj = eventData.get("id");
        if (idObj instanceof String s && s.startsWith("evt_")) {
            return s;
        }
        return null;
    }

    /**
     * Extract order ID from Razorpay webhook payload.
     * Razorpay: data.payment.entity.order_id
     */
    private String extractOrderIdFromPayload(Map<String, Object> eventData) {
        Object dataObj = eventData.get("data");
        if (dataObj instanceof Map<?, ?> dataMap) {
            Object paymentObj = dataMap.get("payment");
            if (paymentObj instanceof Map<?, ?> paymentMap) {
                Object entityObj = paymentMap.get("entity");
                if (entityObj instanceof Map<?, ?> entityMap) {
                    Object orderIdObj = entityMap.get("order_id");
                    if (orderIdObj instanceof String s) {
                        return s;
                    }
                }
            }
        }
        return null;
    }

    /**
     * In-memory set of processed event IDs for webhook deduplication.
     * In production, replace with a database-backed or Redis-backed set
     * with TTL to survive restarts.
     */
    private final java.util.Set<String> processedEvents =
            java.util.concurrent.ConcurrentHashMap.newKeySet();

    /**
     * Fetch the current status of a payment from its gateway adapter.
     * Used for status polling / retry when a previous callback may have timed out.
     */
    @Transactional
    public String fetchFromGateway(Payment payment) {
        try {
            // Resolve the gateway adapter and fetch status
            PaymentGateway gateway = paymentService.resolveGateway(payment.getGateway());
            if (payment.getPaymentId() != null) {
                String gatewayStatus = gateway.fetchPaymentStatus(payment.getPaymentId());
                LOG.info("Gateway status check: paymentId={}, gatewayStatus={}", payment.getId(), gatewayStatus);
                return gatewayStatus;
            }
        } catch (Exception e) {
            LOG.warn("Failed to fetch gateway status for paymentId={}: {}", payment.getId(), e.getMessage());
        }
        return null;
    }

    private void notifyPaymentSuccess(Payment payment) {
        LOG.debug("Payment succeeded: id={}, orderId={}", payment.getId(), payment.getOrderId());
    }

    /**
     * Extract internal_order_id from Stripe webhook event metadata.
     * Stripe events carry metadata at data.object.metadata.internal_order_id.
     */
    private String extractOrderIdFromMetadata(Map<String, Object> eventData) {
        Object dataObj = eventData.get("data");
        if (dataObj instanceof Map<?, ?> dataMap) {
            Object objectObj = dataMap.get("object");
            if (objectObj instanceof Map<?, ?> objectMap) {
                Object metaObj = objectMap.get("metadata");
                if (metaObj instanceof Map<?, ?> metaMap) {
                    Object orderId = metaMap.get("internal_order_id");
                    if (orderId instanceof String s) {
                        return s;
                    }
                }
            }
        }
        return null;
    }
}
