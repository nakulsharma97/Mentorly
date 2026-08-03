package com.skillswap.payment;

import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentVerificationServiceTest {

    @Mock
    private PaymentService paymentService;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private PaymentVerificationService paymentVerificationService;

    private User learner;
    private User admin;
    private Payment payment;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setRole(UserRole.LEARNER);

        admin = new User();
        admin.setId(3L);
        admin.setRole(UserRole.ADMIN);

        payment = Payment.builder()
                .id(1000L)
                .orderId("ORDER_TEST123")
                .learnerId(learner.getId())
                .mentorId(2L)
                .sessionId(10L)
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .status(PaymentStatus.INITIATED)
                .gateway("stripe")
                .createdAt(OffsetDateTime.now())
                .build();
    }

    // ── verifyPayment (authorization / IDOR prevention) ──

    @Test
    void verifyPaymentAllowsOwningLearner() {
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));
        when(paymentService.verifyAndCompletePayment(1000L, "pi_123", "sig_123", Map.of()))
                .thenReturn(payment);

        Payment result = paymentVerificationService.verifyPayment(
                1000L, "pi_123", "sig_123", Map.of(), learner);

        assertEquals(1000L, result.getId());
        verify(paymentService).assertPaymentAccess(payment, learner);
        verify(paymentService).verifyAndCompletePayment(1000L, "pi_123", "sig_123", Map.of());
    }

    @Test
    void verifyPaymentAllowsAdmin() {
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));
        when(paymentService.verifyAndCompletePayment(1000L, "pi_123", "sig_123", Map.of()))
                .thenReturn(payment);

        Payment result = paymentVerificationService.verifyPayment(
                1000L, "pi_123", "sig_123", Map.of(), admin);

        assertEquals(1000L, result.getId());
        verify(paymentService).assertPaymentAccess(payment, admin);
    }

    @Test
    void verifyPaymentRejectsOtherLearner() {
        User otherLearner = new User();
        otherLearner.setId(99L);
        otherLearner.setRole(UserRole.LEARNER);
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));
        // PaymentService.assertPaymentAccess is the ownership gate (unit-tested in
        // PaymentServiceTest); here we verify the denial propagates before any
        // verification/completion runs.
        doThrow(new UnauthorizedException("You do not have access to this payment"))
                .when(paymentService).assertPaymentAccess(payment, otherLearner);

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> paymentVerificationService.verifyPayment(
                        1000L, "pi_123", "sig_123", Map.of(), otherLearner));

        assertEquals("You do not have access to this payment", ex.getMessage());
        verify(paymentService).assertPaymentAccess(payment, otherLearner);
        verify(paymentService, never()).verifyAndCompletePayment(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void verifyPaymentRejectsMentor() {
        User mentor = new User();
        mentor.setId(2L);
        mentor.setRole(UserRole.MENTOR);
        when(paymentRepository.findById(1000L)).thenReturn(Optional.of(payment));
        doThrow(new UnauthorizedException("You do not have access to this payment"))
                .when(paymentService).assertPaymentAccess(payment, mentor);

        assertThrows(UnauthorizedException.class,
                () -> paymentVerificationService.verifyPayment(
                        1000L, "pi_123", "sig_123", Map.of(), mentor));
        verify(paymentService, never()).verifyAndCompletePayment(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void verifyPaymentRejectsPaymentNotFound() {
        when(paymentRepository.findById(9999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentVerificationService.verifyPayment(
                        9999L, "pi_123", "sig_123", Map.of(), learner));
        assertEquals("Payment not found: 9999", ex.getMessage());
    }
}
