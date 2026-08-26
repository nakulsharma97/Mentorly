package com.skillswap.booking;

import com.skillswap.certification.CertificationService;
import com.skillswap.common.ApiClientException;
import com.skillswap.notification.NotificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentService;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.session.SkillSession;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.MentorVerificationStatus;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.wallet.WalletService;
import com.skillswap.wallet.WalletTransactionType;
import com.skillswap.waitlist.SessionWaitlistRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingLifecycleServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private PaymentService paymentService;

    @Mock
    private CertificationService certificationService;

    @Mock
    private SessionWaitlistRepository sessionWaitlistRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private EmailNotificationService emailNotificationService;

    @Mock
    private WalletService walletService;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;

    @Mock
    private MeterRegistry meterRegistry;

    @Captor
    private ArgumentCaptor<Booking> bookingCaptor;

    @InjectMocks
    private BookingLifecycleService bookingLifecycleService;

    private User learner;
    private User mentor;
    private User otherUser;
    private SkillSession session;
    private Booking booking;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setEmail("learner@test.com");
        learner.setRole(UserRole.LEARNER);

        mentor = new User();
        mentor.setId(2L);
        mentor.setEmail("mentor@test.com");
        mentor.setRole(UserRole.MENTOR);
        // Marketplace gates require an admin-APPROVED verification status.
        mentor.setVerificationStatus(MentorVerificationStatus.APPROVED);
        mentor.setProfileCompleted(true);

        otherUser = new User();
        otherUser.setId(3L);
        otherUser.setRole(UserRole.LEARNER);

        session = new SkillSession();
        session.setId(10L);
        session.setMentor(mentor);
        session.setTitle("React Fundamentals");
        session.setPriceAmount(new BigDecimal("100.00"));
        session.setMaxParticipants(2);
        session.setStartTime(OffsetDateTime.now().minusDays(1));
        session.setEndTime(OffsetDateTime.now().plusHours(1));

        booking = new Booking();
        booking.setId(100L);
        booking.setLearner(learner);
        booking.setSession(session);
        booking.setBookingStatus(BookingStatus.PENDING);
    }

    // IdempotencyKeySupport requires 8-120 character keys
    private static final String IDEM_KEY = "key-test-123456";

    // ── createBooking ───────────────────────────────────

    @Test
    void createBookingRejectsNonLearner() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.createBooking(mentor, IDEM_KEY, new BookingRequest(session.getId())));
        assertEquals("Only learners can create bookings", ex.getMessage());
    }

    @Test
    void createBookingRejectsSessionNotFound() {
        when(sessionRepository.findByIdWithLock(session.getId())).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.createBooking(learner, IDEM_KEY, new BookingRequest(session.getId())));
        assertEquals("Session not found", ex.getMessage());
    }

    @Test
    void createBookingRejectsDuplicateBooking() {
        when(sessionRepository.findByIdWithLock(session.getId())).thenReturn(Optional.of(session));
        when(bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(
                eq(session.getId()), eq(learner.getId()), anyList())).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.createBooking(learner, IDEM_KEY, new BookingRequest(session.getId())));
        assertEquals("You already have a booking for this session", ex.getMessage());
    }

    @Test
    void createBookingRejectsFullSession() {
        when(sessionRepository.findByIdWithLock(session.getId())).thenReturn(Optional.of(session));
        when(bookingRepository.countActiveBySessionIdWithLock(eq(session.getId()), anyList())).thenReturn(2L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.createBooking(learner, IDEM_KEY, new BookingRequest(session.getId())));
        assertEquals("Session is full. Join waitlist.", ex.getMessage());
    }

    @Test
    void createBookingSuccess() {
        when(sessionRepository.findByIdWithLock(session.getId())).thenReturn(Optional.of(session));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookingIdempotencyKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                anyLong(), anyString(), anyString())).thenReturn(Optional.empty());

        Booking result = bookingLifecycleService.createBooking(learner, IDEM_KEY,
                new BookingRequest(session.getId()));

        assertNotNull(result);
        assertEquals(BookingStatus.PENDING, result.getBookingStatus());
        assertEquals(learner.getId(), result.getLearner().getId());
        verify(notificationService).notifyUser(eq(mentor.getId()), eq("BOOKING_CREATED"),
                anyString(), anyString(), any());
    }

    @Test
    void createBookingIdempotencyReplay() {
        BookingIdempotencyKey existingKey = new BookingIdempotencyKey();

        when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(
                eq(learner.getId()), anyString(), eq(IDEM_KEY)))
                .thenReturn(Optional.of(existingKey));
        existingKey.setBooking(booking);
        existingKey.setRequestHash(String.valueOf(session.getId()));

        Booking result = bookingLifecycleService.createBooking(learner, IDEM_KEY,
                new BookingRequest(session.getId()));

        assertEquals(booking.getId(), result.getId());
        verify(sessionRepository, never()).findByIdWithLock(anyLong());
    }

    // ── acceptBooking ───────────────────────────────────

    @Test
    void acceptBookingByMentorSuccess() {
        booking.setBookingStatus(BookingStatus.PENDING);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.acceptBooking(100L, mentor);

        assertEquals(BookingStatus.ACCEPTED, result.getBookingStatus());
    }

    @Test
    void acceptBookingByAdminSuccess() {
        User admin = new User();
        admin.setId(99L);
        admin.setRole(UserRole.ADMIN);
        booking.setBookingStatus(BookingStatus.PENDING);

        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.acceptBooking(100L, admin);

        assertEquals(BookingStatus.ACCEPTED, result.getBookingStatus());
    }

    @Test
    void acceptBookingRejectsNonMentor() {
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.acceptBooking(100L, otherUser));
        assertEquals("Only the session mentor can accept a booking", ex.getMessage());
    }

    @Test
    void acceptBookingRejectsNonPending() {
        booking.setBookingStatus(BookingStatus.COMPLETED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.acceptBooking(100L, mentor));
        assertEquals("Only pending bookings can be accepted", ex.getMessage());
    }

    // ── confirmBooking ─────────────────────────────────

    @Test
    void confirmBookingSuccess() {
        booking.setBookingStatus(BookingStatus.ACCEPTED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.confirmBooking(100L, mentor);

        assertEquals(BookingStatus.CONFIRMED, result.getBookingStatus());
        verify(emailNotificationService, times(2)).sendNotificationEmail(any(), anyString(), anyString());
    }

    @Test
    void confirmBookingRejectsWrongState() {
        booking.setBookingStatus(BookingStatus.COMPLETED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.confirmBooking(100L, mentor));
    }

    // ── startBooking ────────────────────────────────────

    @Test
    void startBookingByMentorSuccess() {
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.startBooking(100L, mentor);

        assertEquals(BookingStatus.IN_PROGRESS, result.getBookingStatus());
    }

    @Test
    void startBookingByAssignedLearnerSuccess() {
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.startBooking(100L, learner);

        assertEquals(BookingStatus.IN_PROGRESS, result.getBookingStatus());
    }

    @Test
    void startBookingByAdminSuccess() {
        User admin = new User();
        admin.setId(99L);
        admin.setRole(UserRole.ADMIN);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.startBooking(100L, admin);

        assertEquals(BookingStatus.IN_PROGRESS, result.getBookingStatus());
    }

    @Test
    void startBookingRejectsUnrelatedLearner() {
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.startBooking(100L, otherUser));

        assertEquals("Only the session mentor, assigned learner, or an admin can start a booking",
                ex.getMessage());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void startBookingRejectsUnrelatedMentor() {
        User otherMentor = new User();
        otherMentor.setId(42L);
        otherMentor.setRole(UserRole.MENTOR);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.startBooking(100L, otherMentor));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void startBookingRejectsNullUser() {
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.startBooking(100L, null));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void startBookingRejectsBeforeStartTime() {
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        session.setStartTime(OffsetDateTime.now().plusHours(2));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.startBooking(100L, mentor));
    }

    @Test
    void startBookingRejectsWrongState() {
        booking.setBookingStatus(BookingStatus.PENDING);
        session.setStartTime(OffsetDateTime.now().minusHours(1));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.startBooking(100L, mentor));
    }

    // ── completeBooking ─────────────────────────────────

    @Test
    void completeBookingSuccess() {
        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        session.setEndTime(OffsetDateTime.now().minusMinutes(5));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.completeBooking(100L, mentor);

        assertEquals(BookingStatus.COMPLETED, result.getBookingStatus());
        verify(certificationService).evaluateAndAward(learner);
        verify(certificationService).evaluateAndAward(mentor);
    }

    @Test
    void completeBookingRejectsWrongState() {
        booking.setBookingStatus(BookingStatus.PENDING);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.completeBooking(100L, mentor));
    }

    // ── cancelBooking ───────────────────────────────────

    @Test
    void cancelPendingBookingSuccess() {
        booking.setBookingStatus(BookingStatus.PENDING);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.cancelBooking(100L, learner);

        assertEquals(BookingStatus.CANCELLED, result.getBookingStatus());
        verify(notificationService).notifyUser(eq(mentor.getId()), eq("BOOKING_CANCELLED"),
                anyString(), anyString(), eq(100L));
        verify(emailNotificationService, times(2)).sendNotificationEmail(any(), anyString(), anyString());
    }

    @Test
    void cancelBookingRejectsCompleted() {
        booking.setBookingStatus(BookingStatus.COMPLETED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.cancelBooking(100L, learner));
    }

    // ── holdEscrowForAcceptedBooking ────────────────────

    @Test
    void holdEscrowDeductsFromLearnerWallet() {
        when(walletService.balance(learner)).thenReturn(new WalletService.WalletBalance(
                new BigDecimal("200.00"), "CREDITS"));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        bookingLifecycleService.holdEscrowForAcceptedBooking(booking);

        verify(walletService).addEntryForUser(eq(learner.getId()),
                argThat(req -> req.amount().compareTo(new BigDecimal("100.00")) == 0 &&
                        req.type() == WalletTransactionType.DEBIT));
        verify(paymentRepository).save(argThat(p ->
                p.getStatus() == PaymentStatus.ESCROWED &&
                new BigDecimal("100.00").compareTo(p.getAmount()) == 0));
    }

    @Test
    void holdEscrowRejectsInsufficientBalance() {
        when(walletService.balance(learner)).thenReturn(new WalletService.WalletBalance(
                new BigDecimal("50.00"), "CREDITS"));

        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.holdEscrowForAcceptedBooking(booking));
    }

    @Test
    void holdEscrowSkipsWhenGatewayPaymentAlreadyEscrowed() {
        // A learner who paid through the gateway already has an ESCROWED
        // payment — the mentor's accept must succeed even with an empty wallet
        // (the wallet was never the funding source) and must not touch it.
        Payment escrowed = Payment.builder()
                .id(210L)
                .amount(new BigDecimal("100.00"))
                .status(PaymentStatus.ESCROWED)
                .gateway("razorpay")
                .build();
        booking.setPayment(escrowed);

        bookingLifecycleService.holdEscrowForAcceptedBooking(booking);

        verify(walletService, never()).addEntryForUser(anyLong(), any());
        verify(paymentRepository, never()).save(any());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void holdEscrowSkipsWhenGatewayIntentInFlight() {
        // INITIATED = a gateway order was created but not yet captured. Nothing
        // has been charged, so the wallet must not be debited on top of it
        // (double-charge) nor block acceptance for a wallet-less learner.
        Payment initiated = Payment.builder()
                .id(211L)
                .amount(new BigDecimal("100.00"))
                .status(PaymentStatus.INITIATED)
                .gateway("razorpay")
                .build();
        booking.setPayment(initiated);

        bookingLifecycleService.holdEscrowForAcceptedBooking(booking);

        verify(walletService, never()).addEntryForUser(anyLong(), any());
        verify(paymentRepository, never()).save(any());
        verify(bookingRepository, never()).save(any());
    }

    // ── releaseEscrowForCompletedBooking ─────────────────

    @Test
    void releaseEscrowPaysMentorMinusFee() {
        Payment escrowedPayment = Payment.builder()
                .id(200L)
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .status(PaymentStatus.ESCROWED)
                .build();
        booking.setPayment(escrowedPayment);
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        bookingLifecycleService.releaseEscrowForCompletedBooking(booking);

        verify(walletService).addEntryForUser(eq(mentor.getId()),
                argThat(req -> req.amount().compareTo(new BigDecimal("90.00")) == 0 &&
                        req.type() == WalletTransactionType.EARNING));
        verify(paymentRepository).save(argThat(p -> p.getStatus() == PaymentStatus.RELEASED));
    }

    @Test
    void releaseEscrowSkipsIfNoPayment() {
        bookingLifecycleService.releaseEscrowForCompletedBooking(booking);

        verify(walletService, never()).addEntryForUser(anyLong(), any());
        verify(paymentRepository, never()).save(any());
    }

    // ── refundEscrowForCancelledBooking ──────────────────

    @Test
    void refundEscrowReturnsFundsToLearnerForWalletEscrow() {
        // Wallet-gateway escrow: the learner's wallet is credited AND the
        // gateway-first primitive is invoked (which is idempotent + skips the
        // external call for wallet payments).
        Payment escrowedPayment = Payment.builder()
                .id(200L)
                .amount(new BigDecimal("100.00"))
                .status(PaymentStatus.ESCROWED)
                .gateway("wallet")
                .build();
        booking.setPayment(escrowedPayment);
        when(paymentService.refundForCancellation(200L, new BigDecimal("100.00"), "Booking cancelled"))
                .thenReturn(escrowedPayment);

        int refundPercent = bookingLifecycleService.refundEscrowForCancelledBooking(booking);

        assertEquals(100, refundPercent);
        verify(paymentService).refundForCancellation(200L, new BigDecimal("100.00"), "Booking cancelled");
        verify(walletService).addEntryForUser(eq(learner.getId()),
                argThat(req -> req.amount().compareTo(new BigDecimal("100.00")) == 0 &&
                        req.type() == WalletTransactionType.REFUND));
    }

    @Test
    void refundEscrowForExternalGatewayCreditsNoWallet() {
        // External-gateway escrow: money goes back to the payer at the gateway,
        // so no wallet credit is issued (prevents a double refund).
        Payment escrowedPayment = Payment.builder()
                .id(201L)
                .amount(new BigDecimal("100.00"))
                .status(PaymentStatus.ESCROWED)
                .gateway("razorpay")
                .build();
        booking.setPayment(escrowedPayment);
        when(paymentService.refundForCancellation(201L, new BigDecimal("100.00"), "Booking cancelled"))
                .thenReturn(escrowedPayment);

        int refundPercent = bookingLifecycleService.refundEscrowForCancelledBooking(booking);

        assertEquals(100, refundPercent);
        verify(paymentService).refundForCancellation(201L, new BigDecimal("100.00"), "Booking cancelled");
        verify(walletService, never()).addEntryForUser(anyLong(), any());
    }

    @Test
    void refundEscrowSkipsIfNoPayment() {
        assertEquals(0, bookingLifecycleService.refundEscrowForCancelledBooking(booking));
        verify(paymentService, never()).refundForCancellation(anyLong(), any(), anyString());
        verify(walletService, never()).addEntryForUser(anyLong(), any());
    }

    @Test
    void cancelConfirmedBookingRequestsGatewayRefund() {
        // Direct POST /bookings/{id}/cancel on a confirmed booking must route
        // through the gateway-first primitive (not just flip the DB status).
        Payment escrowedPayment = Payment.builder()
                .id(202L)
                .amount(new BigDecimal("100.00"))
                .status(PaymentStatus.ESCROWED)
                .gateway("razorpay")
                .build();
        booking.setPayment(escrowedPayment);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentService.refundForCancellation(202L, new BigDecimal("100.00"), "Booking cancelled"))
                .thenReturn(escrowedPayment);

        Booking result = bookingLifecycleService.cancelBooking(100L, learner);

        assertEquals(BookingStatus.CANCELLED, result.getBookingStatus());
        verify(paymentService).refundForCancellation(202L, new BigDecimal("100.00"), "Booking cancelled");
    }

    // ── handleStatusUpdate (switch) ─────────────────────

    @Test
    void handleStatusUpdateAccepted() {
        booking.setBookingStatus(BookingStatus.PENDING);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletService.balance(learner)).thenReturn(new WalletService.WalletBalance(
                new BigDecimal("200.00"), "CREDITS"));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.handleStatusUpdate(100L, mentor,
                BookingStatus.ACCEPTED, emailNotificationService);

        assertEquals(BookingStatus.ACCEPTED, result.getBookingStatus());
        verify(emailNotificationService).sendBookingAccepted(learner, mentor, session);
    }

    @Test
    void handleStatusUpdateCompleted() {
        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        session.setEndTime(OffsetDateTime.now().minusMinutes(5));
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // Completing a booking needs a real payment escrowed for releaseEscrow to proceed
        Payment escrow = Payment.builder().id(200L).amount(new BigDecimal("100.00")).status(PaymentStatus.ESCROWED).build();
        booking.setPayment(escrow);
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.handleStatusUpdate(100L, mentor,
                BookingStatus.COMPLETED, emailNotificationService);

        assertEquals(BookingStatus.COMPLETED, result.getBookingStatus());
    }

    @Test
    void handleStatusUpdateCancelled() {
        booking.setBookingStatus(BookingStatus.PENDING);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Booking result = bookingLifecycleService.handleStatusUpdate(100L, learner,
                BookingStatus.CANCELLED, emailNotificationService);

        assertEquals(BookingStatus.CANCELLED, result.getBookingStatus());
    }

    @Test
    void handleStatusUpdateInvalidTransition() {
        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.handleStatusUpdate(100L, mentor,
                        BookingStatus.IN_PROGRESS, emailNotificationService));
    }

    // ── promoteDueBookings ──────────────────────────────

    @Test
    void promoteDueBookingsPromotesEligibleBookings() {
        Booking dueBooking = new Booking();
        dueBooking.setId(101L);
        dueBooking.setBookingStatus(BookingStatus.CONFIRMED);
        dueBooking.setLearner(learner);
        SkillSession dueSession = new SkillSession();
        dueSession.setTitle("Test");
        dueBooking.setSession(dueSession);

        when(bookingRepository.findByBookingStatusInAndSessionStartTimeLessThanEqual(anyList(), any()))
                .thenReturn(List.of(dueBooking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int promoted = bookingLifecycleService.promoteDueBookings();

        assertEquals(1, promoted);
        assertEquals(BookingStatus.IN_PROGRESS, dueBooking.getBookingStatus());
        verify(emailNotificationService, times(2)).sendNotificationEmail(any(), anyString(), anyString());
    }

    // ── recordMentorJoin → SCHEDULED → LIVE ──────────────────────────────

    @Test
    void recordMentorJoinTransitionsScheduledToLive() {
        com.skillswap.session.LiveSessionStatus originalStatus = com.skillswap.session.LiveSessionStatus.SCHEDULED;
        session.setLiveSessionStatus(originalStatus);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        bookingLifecycleService.recordMentorJoin(100L, mentor);

        assertEquals(com.skillswap.session.LiveSessionStatus.LIVE, session.getLiveSessionStatus());
        verify(sessionRepository).save(session);
    }

    @Test
    void recordMentorJoinDoesNotDowngradeLiveToScheduled() {
        session.setLiveSessionStatus(com.skillswap.session.LiveSessionStatus.LIVE);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        bookingLifecycleService.recordMentorJoin(100L, mentor);

        assertEquals(com.skillswap.session.LiveSessionStatus.LIVE, session.getLiveSessionStatus());
        verify(sessionRepository, never()).save(session);
    }

    // ── initiateCompletionConfirmations → LIVE → ENDED ──────────────────

    @Test
    void initiateCompletionConfirmationsTransitionsLiveToEnded() {
        session.setLiveSessionStatus(com.skillswap.session.LiveSessionStatus.LIVE);
        session.setEndTime(OffsetDateTime.now().minusHours(1)); // session already ended
        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        booking.setCompletionReviewStatus(CompletionReviewStatus.NOT_APPLICABLE);
        booking.setSession(session);

        when(bookingRepository.findByBookingStatusIn(List.of(BookingStatus.IN_PROGRESS)))
                .thenReturn(List.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int initiated = bookingLifecycleService.initiateCompletionConfirmations();

        assertEquals(1, initiated);
        assertEquals(com.skillswap.session.LiveSessionStatus.ENDED, session.getLiveSessionStatus());
        assertEquals(CompletionReviewStatus.AWAITING_CONFIRMATION, booking.getCompletionReviewStatus());
        verify(sessionRepository).save(session);
    }

    @Test
    void initiateCompletionConfirmationsDoesNotEndScheduledSession() {
        session.setLiveSessionStatus(com.skillswap.session.LiveSessionStatus.SCHEDULED);
        session.setEndTime(OffsetDateTime.now().minusHours(1)); // session already ended
        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        booking.setCompletionReviewStatus(CompletionReviewStatus.NOT_APPLICABLE);
        booking.setSession(session);

        when(bookingRepository.findByBookingStatusIn(List.of(BookingStatus.IN_PROGRESS)))
                .thenReturn(List.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int initiated = bookingLifecycleService.initiateCompletionConfirmations();

        assertEquals(1, initiated);
        assertEquals(com.skillswap.session.LiveSessionStatus.SCHEDULED, session.getLiveSessionStatus());
        verify(sessionRepository, never()).save(session);
    }

    // ── requestReschedule → RESCHEDULE_REQUESTED / RESCHEDULED ───────────

    @Test
    void requestRescheduleTransitionsBookingAndSession() {
        session.setLiveSessionStatus(com.skillswap.session.LiveSessionStatus.SCHEDULED);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        OffsetDateTime newStart = OffsetDateTime.now().plusDays(3);
        OffsetDateTime newEnd = newStart.plusHours(1);
        Booking result = bookingLifecycleService.requestReschedule(
                100L, mentor, newStart, newEnd, "Conflict on original date");

        assertEquals(BookingStatus.RESCHEDULE_REQUESTED, result.getBookingStatus());
        assertEquals(com.skillswap.session.LiveSessionStatus.RESCHEDULED, session.getLiveSessionStatus());
        verify(notificationService).notifyUser(
                eq(learner.getId()),
                eq("SESSION_RESCHEDULED"),
                anyString(),
                anyString(),
                anyLong());
    }

    @Test
    void requestRescheduleRejectsInProgressBooking() {
        booking.setBookingStatus(BookingStatus.IN_PROGRESS);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        OffsetDateTime newStart = OffsetDateTime.now().plusDays(3);
        OffsetDateTime newEnd = newStart.plusHours(1);
        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.requestReschedule(
                        100L, mentor, newStart, newEnd, "Need to change time"));
    }

    @Test
    void requestRescheduleRejectsCompletedBooking() {
        booking.setBookingStatus(BookingStatus.COMPLETED);
        when(bookingRepository.findById(100L)).thenReturn(Optional.of(booking));

        OffsetDateTime newStart = OffsetDateTime.now().plusDays(3);
        OffsetDateTime newEnd = newStart.plusHours(1);
        assertThrows(IllegalArgumentException.class,
                () -> bookingLifecycleService.requestReschedule(
                        100L, mentor, newStart, newEnd, "Need to change time"));
    }

}
