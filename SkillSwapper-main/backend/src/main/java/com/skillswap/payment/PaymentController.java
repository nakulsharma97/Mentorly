package com.skillswap.payment;

import com.skillswap.booking.BookingRepository;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.AuditableOperation;
import com.skillswap.common.IdempotencyKeySupport;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "Payments", description = "Payment processing, refunds, and transaction history")
@RestController
@Validated
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

        private final PaymentRepository paymentRepository;
        private final BookingRepository bookingRepository;
        private final NotificationService notificationService;
        private final PaymentIdempotencyKeyRepository paymentIdempotencyKeyRepository;
        private final MeterRegistry meterRegistry;

        @GetMapping
        public ApiResponse<List<Payment>> history(@AuthenticationPrincipal User currentUser) {
                if (currentUser.getRole() == UserRole.ADMIN) {
                        return new ApiResponse<>("Payments fetched", paymentRepository.findAll());
                }
                return new ApiResponse<>("Payments fetched",
                                paymentRepository.findByBookingLearnerIdOrBookingSessionMentorId(currentUser.getId(),
                                                currentUser.getId()));
        }

        @PostMapping("/intent")
        @Transactional
        public ApiResponse<Payment> createIntent(@AuthenticationPrincipal User currentUser,
                        @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
                        @Valid @RequestBody PaymentIntentRequest req) {
                if (currentUser.getRole() != UserRole.LEARNER && currentUser.getRole() != UserRole.ADMIN) {
                        incrementCounter("payment.authz.denied", "action", "create_intent");
                        throw new IllegalArgumentException("Only learners can create payment intents");
                }

                IdempotencyKeySupport.validate(idempotencyKey);

                String endpoint = "payments.intent";
                String requestHash = String.join("|",
                                String.valueOf(req.bookingId()),
                                String.valueOf(req.amount()),
                                String.valueOf(req.mode()));

                var existingKey = paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                                currentUser.getId(), endpoint, idempotencyKey);
                if (existingKey.isPresent()) {
                        PaymentIdempotencyKey key = existingKey.get();
                        if (!key.getRequestHash().equals(requestHash)) {
                                throw new IllegalArgumentException("Idempotency key reuse with different payload");
                        }
                        if (key.getPayment() != null) {
                                incrementCounter("payment.intent.replay");
                                return new ApiResponse<>("Payment intent replayed", key.getPayment());
                        }
                }

                var booking = bookingRepository.findById(req.bookingId())
                                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

                if (currentUser.getRole() != UserRole.ADMIN
                                && !booking.getLearner().getId().equals(currentUser.getId())) {
                        throw new IllegalArgumentException("You can only pay for your own booking");
                }

                if (req.amount() == null || req.amount().compareTo(BigDecimal.ZERO) <= 0) {
                        throw new IllegalArgumentException("Amount must be greater than zero");
                }

                Payment payment = new Payment();
                payment.setBooking(booking);
                payment.setAmount(req.amount());
                payment.setMode(req.mode());
                payment.setStatus(PaymentStatus.INITIATED);
                payment.setProviderRef("demo-intent-" + System.currentTimeMillis());

                Payment saved = paymentRepository.save(payment);
                incrementCounter("payment.intent.created");

                try {
                        PaymentIdempotencyKey key = existingKey.orElseGet(PaymentIdempotencyKey::new);
                        key.setUser(currentUser);
                        key.setEndpoint(endpoint);
                        key.setIdempotencyKey(idempotencyKey);
                        key.setRequestHash(requestHash);
                        key.setPayment(saved);
                        paymentIdempotencyKeyRepository.save(key);
                } catch (DataIntegrityViolationException ex) {
                        Payment replayed = paymentIdempotencyKeyRepository
                                        .findByUserIdAndEndpointAndIdempotencyKey(currentUser.getId(), endpoint,
                                                        idempotencyKey)
                                        .map(PaymentIdempotencyKey::getPayment)
                                        .orElse(saved);
                        return new ApiResponse<>("Payment intent replayed", replayed);
                }

                notificationService.notifyUser(
                                booking.getLearner().getId(),
                                "PAYMENT_UPDATE",
                                "Payment initiated",
                                "Payment intent created for booking #" + booking.getId(),
                                saved.getId());
                notificationService.notifyUser(
                                booking.getSession().getMentor().getId(),
                                "PAYMENT_UPDATE",
                                "Payment initiated",
                                "Payment initiated for your booking #" + booking.getId(),
                                saved.getId());

                return new ApiResponse<>("Payment intent created", saved);
        }

        @PatchMapping("/{id}/status")
        @Transactional
        public ApiResponse<Payment> updateStatus(@AuthenticationPrincipal User currentUser,
                        @PathVariable @NotNull @Min(1) Long id,
                        @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
                        @Valid @RequestBody UpdatePaymentStatusRequest req) {
                Payment payment = paymentRepository.findById(id)
                                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));

                boolean ownerMentor = payment.getBooking().getSession().getMentor().getId().equals(currentUser.getId());
                if (currentUser.getRole() != UserRole.ADMIN && !ownerMentor) {
                        incrementCounter("payment.authz.denied", "action", "update_status");
                        throw new IllegalArgumentException("Only the session mentor can update payment status");
                }

                IdempotencyKeySupport.validate(idempotencyKey);

                String endpoint = "payments.status." + id;
                String requestHash = String.valueOf(req.status());
                var existingKey = paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                                currentUser.getId(), endpoint, idempotencyKey);
                if (existingKey.isPresent()) {
                        PaymentIdempotencyKey key = existingKey.get();
                        if (!key.getRequestHash().equals(requestHash)) {
                                throw new IllegalArgumentException("Idempotency key reuse with different payload");
                        }
                        if (key.getPayment() != null) {
                                incrementCounter("payment.status.replay");
                                return new ApiResponse<>("Payment status replayed", key.getPayment());
                        }
                }

                PaymentStatus previousStatus = payment.getStatus();
                payment.setStatus(req.status());
                Payment saved = paymentRepository.save(payment);
                incrementCounter("payment.status.transition",
                                "from", previousStatus.name(),
                                "to", saved.getStatus().name());

                PaymentIdempotencyKey key = existingKey.orElseGet(PaymentIdempotencyKey::new);
                key.setUser(currentUser);
                key.setEndpoint(endpoint);
                key.setIdempotencyKey(idempotencyKey);
                key.setRequestHash(requestHash);
                key.setPayment(saved);
                paymentIdempotencyKeyRepository.save(key);

                notificationService.notifyUser(
                                saved.getBooking().getLearner().getId(),
                                "PAYMENT_UPDATE",
                                "Payment status updated",
                                "Payment #" + saved.getId() + " is now " + saved.getStatus().name(),
                                saved.getId());
                notificationService.notifyUser(
                                saved.getBooking().getSession().getMentor().getId(),
                                "PAYMENT_UPDATE",
                                "Payment status updated",
                                "Payment #" + saved.getId() + " is now " + saved.getStatus().name(),
                                saved.getId());

                return new ApiResponse<>("Payment status updated", saved);
        }

        private void incrementCounter(String name, String... tags) {
                try {
                        meterRegistry.counter(name, tags).increment();
                } catch (RuntimeException ignored) {
                        // No-op in tests where metrics are mocked.
                }
        }
}
