package com.mentorly.payment;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.common.exception.UnauthorizedException;
import com.mentorly.notification.NotificationService;
import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentIdempotencyKeyRepository idempotencyKeyRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private MeterRegistry meterRegistry;

    @Mock
    private PaymentGateway stripeGateway;

    @Mock
    private Counter counter;

    @Captor
    private ArgumentCaptor<Payment> paymentCaptor;

    @InjectMocks
    private PaymentService paymentService;

    private User learner;
    private User mentor;
    private User admin;
    private SkillSession session;
    private Booking booking;
    private Payment payment;

    // IdempotencyKeySupport requires 8-120 character keys
    private static final String IDEM_KEY = "key-test-123456";

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setRole(UserRole.LEARNER);

        mentor = new User();
        mentor.setId(2L);
        mentor.setRole(UserRole.MENTOR);

        admin = new User();
        admin.setId(3L);
        admin.setRole(UserRole.ADMIN);

        session = new SkillSession();
        session.setId(10L);
        session.setMentor(mentor);
        session.setTitle("Test Session");

        booking = new Booking();
        booking.setId(100L);
        booking.setLearner(learner);
        booking.setSession(session);

        payment = Payment.builder()
                .id(1000L)
                .orderId("ORDER_TEST123")
                .learnerId(learner.getId())
                .mentorId(mentor.getId())
                .sessionId(session.getId())
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .status(PaymentStatus.INITIATED)
                .gateway("stripe")
                .createdAt(OffsetDateTime.now())
                .build();

        // @InjectMocks may not auto-populate List<PaymentGateway> from a single @Mock,
        // so inject the gateways list via reflection to ensure gateway resolution works.
        try {
            java.lang.reflect.Field gatewaysField = PaymentService.class.getDeclaredField("gateways");
            gatewaysField.setAccessible(true);
            gatewaysField.set(paymentService, List.of(stripeGateway));
        } catch (Exception e) {
            throw new RuntimeException("Failed to inject gateways list", e);
        }

        lenient().when(meterRegistry.counter(anyString(), any(String[].class))).thenReturn(counter);
        lenient().when(stripeGateway.getGatewaySlug()).thenReturn("stripe");
        lenient().when(stripeGateway.createOrder(anyString(), any(), anyString()))
                .thenReturn(Map.of("id", "pi_test_123", "status", "created"));
        lenient().when(stripeGateway.verifyPayment(anyString(), anyString(), anyString(), any()))
                .thenReturn(true);
        lenient().when(stripeGateway.processRefund(any(), any(), any()))
                .thenReturn("refund_test_123");
    }

    // ── createPaymentOrder ──────────────────────────────

    @Test
    void createPaymentOrderRejectsNonPositiveAmount() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(learner, IDEM_KEY, 100L,
                        BigDecimal.ZERO, "stripe"));
        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void createPaymentOrderRejectsNegativeAmount() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(learner, IDEM_KEY, 100L,
                        new BigDecimal("-50.00"), "stripe"));
        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void createPaymentOrderRejectsMentorRole() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(mentor, IDEM_KEY, 100L,
                        new BigDecimal("100.00"), "stripe"));
        assertEquals("Only learners can create payment intents", ex.getMessage());
    }

    @Test
    void createPaymentOrderAllowsAdminRole() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(idempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                anyLong(), anyString(), anyString())).thenReturn(Optional.empty());

        Payment result = paymentService.createPaymentOrder(admin, IDEM_KEY, 100L,
                new BigDecimal("100.00"), "stripe");

        assertNotNull(result);
        assertEquals("stripe", result.getGateway());
        verify(paymentRepository).save(any());
    }

    @Test
    void createPaymentOrderRejectsBookingNotFound() {
        when(bookingRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(learner, IDEM_KEY, 999L,
                        new BigDecimal("100.00"), "stripe"));
        assertEquals("Booking not found", ex.getMessage());
    }

    @Test
    void createPaymentOrderRejectsUnauthorizedLearner() {
        User otherLearner = new User();
        otherLearner.setId(99L);
        otherLearner.setRole(UserRole.LEARNER);

        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(otherLearner, IDEM_KEY, 100L,
                        new BigDecimal("100.00"), "stripe"));
        assertEquals("You can only pay for your own booking", ex.getMessage());
    }

    @Test
    void createPaymentOrderSuccess() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(idempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                anyLong(), anyString(), anyString())).thenReturn(Optional.empty());

        Payment result = paymentService.createPaymentOrder(learner, IDEM_KEY, 100L,
                new BigDecimal("100.00"), "stripe");

        assertNotNull(result);
        assertEquals("stripe", result.getGateway());
        assertEquals(PaymentStatus.INITIATED, result.getStatus());
        assertEquals(new BigDecimal("100.00"), result.getAmount());
        assertNotNull(result.getGatewayResponse());

        verify(bookingRepository).save(argThat(b -> b.getPayment() != null));
        verify(notificationService, times(2)).notifyUser(anyLong(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void createPaymentOrderIdempotencyReplay() {
        PaymentIdempotencyKey existingKey = createIdempotencyKey(payment);
        when(idempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                anyLong(), anyString(), eq(IDEM_KEY))).thenReturn(Optional.of(existingKey));

        Payment result = paymentService.createPaymentOrder(learner, IDEM_KEY, 100L,
                new BigDecimal("100.00"), "stripe");

        assertEquals(payment.getId(), result.getId());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void createPaymentOrderRejectsIdempotencyKeyMismatch() {
        Payment differentPayment = Payment.builder().id(2000L).build();
        PaymentIdempotencyKey existingKey = new PaymentIdempotencyKey();
        existingKey.setPayment(differentPayment);
        existingKey.setRequestHash("different-hash");

        when(idempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                anyLong(), anyString(), eq(IDEM_KEY))).thenReturn(Optional.of(existingKey));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(learner, IDEM_KEY, 100L,
                        new BigDecimal("100.00"), "stripe"));
        assertEquals("Idempotency key reuse with different payload", ex.getMessage());
    }

    @Test
    void createPaymentOrderRejectsUnsupportedGateway() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        // @InjectMocks may not auto-populate List<PaymentGateway> from a single @Mock,
        // so manually inject the list to enable gateway resolution testing
        PaymentGateway paypalGateway = mock(PaymentGateway.class);
        when(paypalGateway.getGatewaySlug()).thenReturn("paypal");
        try {
            java.lang.reflect.Field field = PaymentService.class.getDeclaredField("gateways");
            field.setAccessible(true);
            field.set(paymentService, List.of(paypalGateway));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.createPaymentOrder(learner, IDEM_KEY, 100L,
                        new BigDecimal("100.00"), "bitcoin"));
        assertEquals("Unsupported payment gateway: bitcoin", ex.getMessage());
    }

    // ── verifyAndCompletePayment ────────────────────────

    @Test
    void verifyAndCompletePaymentSuccess() {
        payment.setStatus(PaymentStatus.INITIATED);
        payment.setGatewayOrderId("stripe_order_123");
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.verifyAndCompletePayment(1000L, "pi_test_123",
                "sig_123", Map.of());

        assertEquals(PaymentStatus.ESCROWED, result.getStatus());
        assertEquals("pi_test_123", result.getPaymentId());
        assertEquals("sig_123", result.getSignature());
        // Verify gatewayOrderId was passed to gateway, not the internal ORDER_TEST123
        verify(stripeGateway).verifyPayment(eq("pi_test_123"), eq("stripe_order_123"), eq("sig_123"), any());
    }

    @Test
    void verifyAndCompletePaymentFallsBackToInternalOrderIdWhenGatewayOrderIdIsNull() {
        // Legacy row before V77 migration — gatewayOrderId is null
        payment.setStatus(PaymentStatus.INITIATED);
        payment.setGatewayOrderId(null);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.verifyAndCompletePayment(1000L, "pi_test_123",
                "sig_123", Map.of());

        assertEquals(PaymentStatus.ESCROWED, result.getStatus());
        // Falls back to internal orderId for legacy rows
        verify(stripeGateway).verifyPayment(eq("pi_test_123"), eq("ORDER_TEST123"), eq("sig_123"), any());
    }

    @Test
    void verifyAndCompletePaymentFailsVerification() {
        payment.setStatus(PaymentStatus.INITIATED);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(stripeGateway.verifyPayment(anyString(), anyString(), anyString(), any()))
                .thenReturn(false);

        Payment result = paymentService.verifyAndCompletePayment(1000L, "pi_bad", "sig_bad", Map.of());

        assertEquals(PaymentStatus.FAILED, result.getStatus());
    }

    @Test
    void verifyAndCompletePaymentPaymentNotFound() {
        when(paymentRepository.findByIdWithLock(9999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.verifyAndCompletePayment(9999L, "pi_test", "sig", Map.of()));
        assertTrue(ex.getMessage().contains("Payment not found"));
    }

    // ── getPayment (authorization / IDOR prevention) ─────

    @Test
    void getPaymentAllowsOwningLearner() {
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));

        Payment result = paymentService.getPayment(1000L, learner);

        assertEquals(1000L, result.getId());
    }

    @Test
    void getPaymentAllowsAdmin() {
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));

        Payment result = paymentService.getPayment(1000L, admin);

        assertEquals(1000L, result.getId());
    }

    @Test
    void getPaymentRejectsOtherLearner() {
        User otherLearner = new User();
        otherLearner.setId(99L);
        otherLearner.setRole(UserRole.LEARNER);
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> paymentService.getPayment(1000L, otherLearner));
        assertEquals("You do not have access to this payment", ex.getMessage());
    }

    @Test
    void getPaymentAllowsMentorOfRecord() {
        // Mentors are party to payments they received (mirrors getPaymentHistory),
        // so they may view their own payment records but not refund/verify them.
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));

        Payment result = paymentService.getPayment(1000L, mentor);

        assertEquals(1000L, result.getId());
    }

    @Test
    void getPaymentRejectsPaymentNotFound() {
        when(paymentRepository.findById(9999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.getPayment(9999L, learner));
        assertTrue(ex.getMessage().contains("Payment not found"));
    }

    // ── refundPayment (learner/admin endpoint) ───────────

    @Test
    void refundPaymentSuccess() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundPayment(1000L, new BigDecimal("100.00"), "Customer request", learner);

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("100.00")), eq("Customer request"));
    }

    @Test
    void refundPaymentRejectsNonEscrowed() {
        payment.setStatus(PaymentStatus.INITIATED);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundPayment(1000L, new BigDecimal("50.00"), "Test", learner));
        assertTrue(ex.getMessage().contains("Only escrowed payments can be refunded"));
    }

    @Test
    void refundPaymentRejectsWalletEscrowOnStandaloneEndpoint() {
        // Wallet escrow is refunded via the booking cancellation flow (wallet
        // credit); this endpoint must not silently flip it to REFUNDED.
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setGateway("wallet");
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundPayment(1000L, new BigDecimal("50.00"), "Test", learner));
        assertTrue(ex.getMessage().contains("Wallet escrow refunds are processed through the booking"));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundPaymentPaymentNotFound() {
        when(paymentRepository.findByIdWithLock(9999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundPayment(9999L, new BigDecimal("50.00"), "Test", learner));
        assertTrue(ex.getMessage().contains("Payment not found"));
    }

    @Test
    void refundPaymentRejectsOtherLearner() {
        payment.setStatus(PaymentStatus.ESCROWED);
        User otherLearner = new User();
        otherLearner.setId(99L);
        otherLearner.setRole(UserRole.LEARNER);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> paymentService.refundPayment(1000L, new BigDecimal("50.00"), "Test", otherLearner));
        assertEquals("You do not have access to this payment", ex.getMessage());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundPaymentRejectsMentor() {
        // Refunding is a payer/admin decision — the recipient mentor may not
        // reverse the learner's payment.
        payment.setStatus(PaymentStatus.ESCROWED);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        assertThrows(UnauthorizedException.class,
                () -> paymentService.refundPayment(1000L, new BigDecimal("50.00"), "Test", mentor));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundPaymentAllowsAdmin() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundPayment(1000L, new BigDecimal("100.00"), "Admin refund", admin);

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("100.00")), eq("Admin refund"));
    }

    @Test
    void refundPaymentAllowsFullRefundEqualToOriginalAmount() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        payment.setAmount(new BigDecimal("250.00"));
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundPayment(1000L, new BigDecimal("250.00"), "Full refund", learner);

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("250.00")), eq("Full refund"));
    }

    @Test
    void refundPaymentAllowsPartialRefundLessThanOriginalAmount() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        payment.setAmount(new BigDecimal("500.00"));
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundPayment(1000L, new BigDecimal("300.00"), "Partial refund", learner);

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("300.00")), eq("Partial refund"));
    }

    @Test
    void refundPaymentRejectsRefundAmountGreaterThanOriginal() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        payment.setAmount(new BigDecimal("100.00"));
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundPayment(1000L, new BigDecimal("150.00"), "Too much", learner));
        assertEquals("Refund amount cannot exceed original payment amount: 100.00", ex.getMessage());
        verify(stripeGateway, never()).processRefund(any(), any(), any());
        verify(paymentRepository, never()).save(any());
    }

    // ── refundForCancellation (booking cancel / admin flows) ──

    @Test
    void refundForCancellationCallsGatewayBeforeStatusFlip() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundForCancellation(1000L, new BigDecimal("100.00"), "Booking cancelled");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        // Gateway must be called before the DB status is flipped.
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("100.00")), eq("Booking cancelled"));
        verify(paymentRepository).save(argThat(p -> p.getStatus() == PaymentStatus.REFUNDED));
    }

    @Test
    void refundForCancellationSkipsGatewayForWalletEscrow() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setGateway("wallet");
        payment.setPaymentId(null);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundForCancellation(1000L, new BigDecimal("100.00"), "Booking cancelled");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway, never()).processRefund(any(), any(), any());
    }

    @Test
    void refundForCancellationIsIdempotentWhenAlreadyRefunded() {
        payment.setStatus(PaymentStatus.REFUNDED);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        Payment result = paymentService.refundForCancellation(1000L, new BigDecimal("100.00"), "Booking cancelled");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway, never()).processRefund(any(), any(), any());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundForCancellationRejectsNonRefundableStatus() {
        payment.setStatus(PaymentStatus.RELEASED);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundForCancellation(1000L, new BigDecimal("100.00"), "Booking cancelled"));
        assertTrue(ex.getMessage().contains("Only escrowed or initiated payments can be refunded"));
        verify(stripeGateway, never()).processRefund(any(), any(), any());
    }

    @Test
    void refundForCancellationPaymentNotFound() {
        when(paymentRepository.findByIdWithLock(9999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundForCancellation(9999L, new BigDecimal("100.00"), "Booking cancelled"));
    }

    @Test
    void refundForCancellationRejectsMissingGatewayPaymentId() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId(null);
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        assertThrows(IllegalStateException.class,
                () -> paymentService.refundForCancellation(1000L, new BigDecimal("100.00"), "Booking cancelled"));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundForCancellationAllowsFullRefundEqualToOriginalAmount() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        payment.setAmount(new BigDecimal("300.00"));
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundForCancellation(1000L, new BigDecimal("300.00"), "Full cancel refund");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("300.00")), eq("Full cancel refund"));
    }

    @Test
    void refundForCancellationAllowsPartialRefundLessThanOriginalAmount() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        payment.setAmount(new BigDecimal("800.00"));
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.refundForCancellation(1000L, new BigDecimal("400.00"), "Partial cancel refund");

        assertEquals(PaymentStatus.REFUNDED, result.getStatus());
        verify(stripeGateway).processRefund(eq("pi_test_123"), eq(new BigDecimal("400.00")), eq("Partial cancel refund"));
    }

    @Test
    void refundForCancellationRejectsRefundAmountGreaterThanOriginal() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        payment.setAmount(new BigDecimal("200.00"));
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.refundForCancellation(1000L, new BigDecimal("500.00"), "Too much cancel refund"));
        assertEquals("Refund amount cannot exceed original payment amount: 200.00", ex.getMessage());
        verify(stripeGateway, never()).processRefund(any(), any(), any());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundForCancellationPropagatesGatewayFailure() {
        payment.setStatus(PaymentStatus.ESCROWED);
        payment.setPaymentId("pi_test_123");
        when(paymentRepository.findByIdWithLock(1000L)).thenReturn(Optional.of(payment));
        when(stripeGateway.processRefund(any(), any(), any()))
                .thenThrow(new IllegalStateException("Gateway unavailable"));

        assertThrows(IllegalStateException.class,
                () -> paymentService.refundForCancellation(1000L, new BigDecimal("100.00"), "Booking cancelled"));
        // DB must NOT be flipped when the gateway call fails.
        verify(paymentRepository, never()).save(any());
    }

    // ── getPaymentHistory ───────────────────────────────

    @Test
    void getPaymentHistoryForLearner() {
        when(paymentRepository.findByLearnerIdOrMentorId(learner.getId(), learner.getId()))
                .thenReturn(List.of(payment));

        List<Payment> history = paymentService.getPaymentHistory(learner);

        assertEquals(1, history.size());
        verify(paymentRepository).findByLearnerIdOrMentorId(learner.getId(), learner.getId());
    }

    @Test
    void getPaymentHistoryForAdmin() {
        lenient().when(paymentRepository.findByFilters(isNull(), isNull(), isNull(), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(payment)));

        List<Payment> history = paymentService.getPaymentHistory(admin);

        assertEquals(1, history.size());
    }

    // ── updatePaymentStatus (admin-only) ────────────────

    @Test
    void updatePaymentStatusAllowsAdmin() {
        payment.setStatus(PaymentStatus.INITIATED);
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Payment result = paymentService.updatePaymentStatus(1000L, PaymentStatus.ESCROWED, admin);

        assertEquals(PaymentStatus.ESCROWED, result.getStatus());
    }

    @Test
    void updatePaymentStatusRejectsLearner() {
        assertThrows(UnauthorizedException.class,
                () -> paymentService.updatePaymentStatus(1000L, PaymentStatus.ESCROWED, learner));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void updatePaymentStatusRejectsMentor() {
        assertThrows(UnauthorizedException.class,
                () -> paymentService.updatePaymentStatus(1000L, PaymentStatus.ESCROWED, mentor));
    }

    // ── helpers ─────────────────────────────────────────

    private PaymentIdempotencyKey createIdempotencyKey(Payment p) {
        PaymentIdempotencyKey key = new PaymentIdempotencyKey();
        key.setPayment(p);
        // Must match the hash format in PaymentService.createPaymentOrder:
        // String.join("|", bookingId, amount, gatewaySlug)
        key.setRequestHash("100|" + p.getAmount() + "|stripe");
        return key;
    }
}
