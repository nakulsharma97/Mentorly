package com.skillswap.payment;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentControllerServiceTest {

    @Mock
    private PaymentService paymentService;
    @Mock
    private PaymentVerificationService paymentVerificationService;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private PaymentIdempotencyKeyRepository paymentIdempotencyKeyRepository;
    @Mock
    private MeterRegistry meterRegistry;

    @InjectMocks
    private PaymentController paymentController;

    @Test
    void createIntentRejectsMentorRole() {
        User mentor = new User();
        mentor.setRole(UserRole.MENTOR);
        mentor.setId(20L);

        when(paymentService.createPaymentOrder(any(User.class), anyString(), anyLong(), any(), anyString()))
                .thenThrow(new IllegalArgumentException("Only learners can create payment intents"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentController.createIntent(mentor, "idem-1",
                        new PaymentController.CreatePaymentIntentRequest(1L, new BigDecimal("10.00"), "razorpay")));

        assertEquals("Only learners can create payment intents", ex.getMessage());
    }

    @Test
    void createIntentRejectsNonPositiveAmount() {
        User learner = new User();
        learner.setId(10L);
        learner.setRole(UserRole.LEARNER);

        when(paymentService.createPaymentOrder(any(User.class), anyString(), anyLong(), any(), anyString()))
                .thenThrow(new IllegalArgumentException("Amount must be greater than zero"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentController.createIntent(learner, "idem-key-123",
                        new PaymentController.CreatePaymentIntentRequest(1L, BigDecimal.ZERO, "razorpay")));

        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void getPaymentHistoryReturnsPayments() {
        User learner = new User();
        learner.setId(10L);
        learner.setRole(UserRole.LEARNER);

        when(paymentService.getPaymentHistory(any(User.class))).thenReturn(java.util.Collections.emptyList());

        var response = paymentController.history(learner);
        assertEquals("Payments fetched", response.message());
    }
}
