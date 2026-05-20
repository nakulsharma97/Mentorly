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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentControllerServiceTest {

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

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentController.createIntent(mentor, "idem-1",
                        new PaymentController.PaymentIntentRequest(1L, new BigDecimal("10.00"), "CARD")));

        assertEquals("Only learners can create payment intents", ex.getMessage());
    }

    @Test
    void createIntentRejectsNonPositiveAmount() {
        User learner = new User();
        learner.setId(10L);
        learner.setRole(UserRole.LEARNER);

        User mentor = new User();
        mentor.setId(20L);
        mentor.setRole(UserRole.MENTOR);

        SkillSession session = new SkillSession();
        session.setMentor(mentor);

        Booking booking = new Booking();
        booking.setId(1L);
        booking.setLearner(learner);
        booking.setSession(session);

        when(bookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(10L, "payments.intent",
                "idem-key-123"))
                .thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentController.createIntent(learner, "idem-key-123",
                        new PaymentController.PaymentIntentRequest(1L, BigDecimal.ZERO, "UPI")));

        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void updateStatusRejectsNonMentorAndNonAdmin() {
        User learner = new User();
        learner.setId(10L);
        learner.setRole(UserRole.LEARNER);

        User mentor = new User();
        mentor.setId(20L);

        SkillSession session = new SkillSession();
        session.setMentor(mentor);

        Booking booking = new Booking();
        booking.setSession(session);

        Payment payment = new Payment();
        payment.setId(4L);
        payment.setBooking(booking);

        when(paymentRepository.findById(4L)).thenReturn(Optional.of(payment));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentController.updateStatus(learner, 4L, "idem-3",
                        new PaymentController.UpdatePaymentStatusRequest(PaymentStatus.ESCROWED)));

        assertEquals("Only the session mentor can update payment status", ex.getMessage());
    }
}
