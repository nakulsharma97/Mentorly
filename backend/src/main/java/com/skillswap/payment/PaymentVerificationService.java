package com.skillswap.payment;

import com.skillswap.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Handles payment verification callbacks from external payment gateways.
 * Processes webhook events and idempotency-safe payment confirmations.
 */
@Service
@RequiredArgsConstructor
public class PaymentVerificationService {

    private static final Logger log = LoggerFactory.getLogger(PaymentVerificationService.class);

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final NotificationService notificationService;

    /**
     * Process a payment verification callback (from frontend redirect or webhook).
     *
     * @param paymentId     Internal payment ID
     * @param gatewayPaymentId  Payment ID from the gateway (e.g. Razorpay payment_id)
     * @param signature     Signature/hmac from gateway for verification
     * @param extraParams   Additional gateway-specific parameters
     * @return Verified payment entity
     */
    @Transactional
    public Payment verifyPayment(Long paymentId, String gatewayPaymentId, String signature,
            Map<String, String> extraParams) {
        Payment verified = paymentService.verifyAndCompletePayment(paymentId, gatewayPaymentId, signature, extraParams);

        if (verified.getStatus() == PaymentStatus.ESCROWED) {
            notifyPaymentSuccess(verified);
            log.info("Payment verification callback succeeded: paymentId={}, gatewayPaymentId={}",
                    paymentId, gatewayPaymentId);
        } else {
            log.warn("Payment verification callback failed: paymentId={}, gatewayPaymentId={}, status={}",
                    paymentId, gatewayPaymentId, verified.getStatus());
        }

        return verified;
    }

    /**
     * Process a gateway webhook event (e.g. payment.captured, payment.failed).
     */
    @Transactional
    public Payment processWebhookEvent(String gatewaySlug, String eventType, String gatewayPaymentId,
            Map<String, Object> eventData) {
        log.info("Processing webhook event: gateway={}, eventType={}, gatewayPaymentId={}",
                gatewaySlug, eventType, gatewayPaymentId);

        // Find the payment by gateway payment ID
        Payment payment = paymentRepository.findByPaymentId(gatewayPaymentId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment not found for gateway payment ID: " + gatewayPaymentId));

        switch (eventType) {
            case "payment.captured":
            case "charge.captured":
            case "CHECKOUT.ORDER.APPROVED":
                if (payment.getStatus() == PaymentStatus.INITIATED) {
                    payment.setStatus(PaymentStatus.ESCROWED);
                    Payment saved = paymentRepository.save(payment);
                    notifyPaymentSuccess(saved);
                    log.info("Webhook payment captured: paymentId={}", saved.getId());
                    return saved;
                }
                break;

            case "payment.failed":
            case "charge.failed":
            case "CHECKOUT.ORDER.DECLINED":
                payment.setStatus(PaymentStatus.FAILED);
                Payment saved = paymentRepository.save(payment);
                log.warn("Webhook payment failed: paymentId={}", saved.getId());
                return saved;

            default:
                log.info("Unhandled webhook event type: {} for gateway {}", eventType, gatewaySlug);
        }

        return payment;
    }

    private void notifyPaymentSuccess(Payment payment) {
        // Find booking via payment (we need the booking repository lookup)
        // Since Payment now has direct fields, we can't navigate payment -> booking
        // The notification is handled by the controller/service that initiated the verification
        log.debug("Payment succeeded: id={}, orderId={}", payment.getId(), payment.getOrderId());
    }
}
