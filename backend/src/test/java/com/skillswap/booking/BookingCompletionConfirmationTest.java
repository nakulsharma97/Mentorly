package com.skillswap.booking;

import com.skillswap.certification.CertificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentService;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.session.SkillSession;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.wallet.WalletService;
import com.skillswap.waitlist.SessionWaitlistRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for the dual-confirmation session completion flow.
 */
@ExtendWith(MockitoExtension.class)
class BookingCompletionConfirmationTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private PaymentService paymentService;
    @Mock private CertificationService certificationService;
    @Mock private SessionWaitlistRepository sessionWaitlistRepository;
    @Mock private NotificationService notificationService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private WalletService walletService;
    @Mock private SessionRepository sessionRepository;
    @Mock private BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;
    @Mock private MeterRegistry meterRegistry;

    @InjectMocks
    private BookingLifecycleService bookingLifecycleService;

    private User learner;
    private User mentor;
    private SkillSession session;
    private Booking booking;
    private Payment escrowedPayment;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setFullName("Test Learner");
        learner.setEmail("learner@test.com");
        learner.setRole(UserRole.LEARNER);

        mentor = new User();
        mentor.setId(2L);
        mentor.setFullName("Test Mentor");
        mentor.setEmail("mentor@test.com");
        mentor.setRole(UserRole.MENTOR);

        session = new SkillSession();
        session.setId(10L);
        session.setMentor(mentor);
        session.setTitle("React Fundamentals");
        session.setStartTime(OffsetDateTime.now().minusHours(2));
        session.setEndTime(OffsetDateTime.now().minusMinutes(30));

        booking = new Booking();
        booking.setId(100L);
        booking.setLearner(learner);
        booking.setSession(session);
        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        booking.setCompletionReviewStatus(CompletionReviewStatus.AWAITING_CONFIRMATION);

        escrowedPayment = Payment.builder()
                .id(200L)
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .status(PaymentStatus.ESCROWED)
                .build();
        booking.setPayment(escrowedPayment);
    }

    // ── confirmSessionCompletion ────────────────────────────────

    @Test
    void confirmSessionCompletion_learnerConfirmsFirst() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.confirmSessionCompletion(100L, learner);

        assertEquals(ConfirmationStatus.CONFIRMED, result.getLearnerConfirmationStatus());
        assertNotNull(result.getLearnerConfirmedAt());
        assertEquals(ConfirmationStatus.PENDING, result.getMentorConfirmationStatus());
        // Booking should NOT be completed yet (only one side confirmed)
        assertEquals(BookingStatus.IN_PROGRESS, result.getBookingStatus());
    }

    @Test
    void confirmSessionCompletion_bothConfirm_completesBooking() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Learner confirms first
        bookingLifecycleService.confirmSessionCompletion(100L, learner);

        // Mentor confirms second
        Booking result = bookingLifecycleService.confirmSessionCompletion(100L, mentor);

        assertEquals(ConfirmationStatus.CONFIRMED, result.getMentorConfirmationStatus());
        assertEquals(BookingStatus.COMPLETED, result.getBookingStatus());
        assertEquals(CompletionReviewStatus.RESOLVED, result.getCompletionReviewStatus());
        // Escrow should be released
        verify(paymentRepository).save(argThat(p -> p.getStatus() == PaymentStatus.RELEASED));
    }

    @Test
    void confirmSessionCompletion_rejectsIfNotParticipant() {
        User otherUser = new User();
        otherUser.setId(99L);
        otherUser.setRole(UserRole.LEARNER);

        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.confirmSessionCompletion(100L, otherUser));
    }

    @Test
    void confirmSessionCompletion_rejectsIfNotAwaitingConfirmation() {
        booking.setCompletionReviewStatus(CompletionReviewStatus.NOT_APPLICABLE);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.confirmSessionCompletion(100L, learner));
    }

    @Test
    void confirmSessionCompletion_rejectsDuplicateConfirmation() {
        booking.setLearnerConfirmationStatus(ConfirmationStatus.CONFIRMED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.confirmSessionCompletion(100L, learner));
    }

    // ── disputeSessionCompletion ────────────────────────────────

    @Test
    void disputeSessionCompletion_learnerDisputes() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.disputeSessionCompletion(
                100L, learner, "The session did not happen as scheduled");

        assertEquals(ConfirmationStatus.DISPUTED, result.getLearnerConfirmationStatus());
        assertEquals("The session did not happen as scheduled", result.getLearnerDisputeReason());
        assertEquals(CompletionReviewStatus.DISPUTED, result.getCompletionReviewStatus());
        assertEquals(BookingStatus.REVIEW_REQUIRED, result.getBookingStatus());
        // Should notify admins
        verify(notificationService).notifyAdmins(eq("SESSION_DISPUTE"), anyString(), anyString(), eq(100L));
    }

    @Test
    void disputeSessionCompletion_rejectsShortReason() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.disputeSessionCompletion(100L, learner, "short"));
    }

    @Test
    void disputeSessionCompletion_rejectsBlankReason() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.disputeSessionCompletion(100L, learner, "   "));
    }

    // ── checkAwaitingConfirmations ──────────────────────────────

    @Test
    void checkAwaitingConfirmations_escalatesAfterTimeout() {
        session.setEndTime(OffsetDateTime.now().minusHours(25)); // 25 hours ago
        when(bookingRepository.findByCompletionReviewStatus(CompletionReviewStatus.AWAITING_CONFIRMATION))
                .thenReturn(List.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int escalated = bookingLifecycleService.checkAwaitingConfirmations(24);

        assertEquals(1, escalated);
        assertEquals(CompletionReviewStatus.REVIEW_REQUIRED, booking.getCompletionReviewStatus());
        verify(notificationService).notifyAdmins(eq("SESSION_REVIEW_NEEDED"), anyString(), anyString(), eq(100L));
    }

    @Test
    void checkAwaitingConfirmations_doesNotEscalateBeforeTimeout() {
        session.setEndTime(OffsetDateTime.now().minusHours(10)); // 10 hours ago
        when(bookingRepository.findByCompletionReviewStatus(CompletionReviewStatus.AWAITING_CONFIRMATION))
                .thenReturn(List.of(booking));

        int escalated = bookingLifecycleService.checkAwaitingConfirmations(24);

        assertEquals(0, escalated);
        assertEquals(CompletionReviewStatus.AWAITING_CONFIRMATION, booking.getCompletionReviewStatus());
    }

    @Test
    void checkAwaitingConfirmations_doesNotEscalateIfBothConfirmed() {
        session.setEndTime(OffsetDateTime.now().minusHours(25));
        booking.setLearnerConfirmationStatus(ConfirmationStatus.CONFIRMED);
        booking.setMentorConfirmationStatus(ConfirmationStatus.CONFIRMED);
        when(bookingRepository.findByCompletionReviewStatus(CompletionReviewStatus.AWAITING_CONFIRMATION))
                .thenReturn(List.of(booking));

        int escalated = bookingLifecycleService.checkAwaitingConfirmations(24);

        assertEquals(0, escalated);
    }

    // ── recordMentorJoin ────────────────────────────────────────

    @Test
    void recordMentorJoin_setsTimestamp() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.recordMentorJoin(100L, mentor);

        assertNotNull(result.getMentorJoinLinkRequestedAt());
    }

    @Test
    void recordMentorJoin_doesNotOverwriteTimestamp() {
        OffsetDateTime existing = OffsetDateTime.now().minusHours(1);
        booking.setMentorJoinLinkRequestedAt(existing);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.recordMentorJoin(100L, mentor);

        assertEquals(existing, result.getMentorJoinLinkRequestedAt());
    }

    @Test
    void recordMentorJoin_rejectsNonMentor() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.recordMentorJoin(100L, learner));
    }
}
