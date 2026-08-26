package com.mentorly.booking;

import com.mentorly.certification.CertificationService;
import com.mentorly.common.ApiClientException;
import com.mentorly.common.GlobalExceptionHandler;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.config.EndpointRateLimitFilter;
import com.mentorly.config.JwtAuthenticationFilter;
import com.mentorly.config.MaintenanceModeFilter;
import com.mentorly.config.RequestTraceFilter;
import com.mentorly.notification.NotificationService;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.payment.PaymentRepository;
import com.mentorly.session.SessionRepository;
import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import com.mentorly.waitlist.SessionWaitlistRepository;
import com.mentorly.wallet.WalletService;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BookingController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class BookingControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ── Controller dependencies ────────────────────────────

    @MockBean
    private BookingRepository bookingRepository;

    @MockBean
    private WalletService walletService;

    @MockBean
    private EmailNotificationService emailService;

    @MockBean
    private BookingLifecycleService bookingLifecycleService;

    @MockBean
    private SessionRepository sessionRepository;

    @MockBean
    private PaymentRepository paymentRepository;

    @MockBean
    private NotificationService notificationService;

    @MockBean
    private CertificationService certificationService;

    @MockBean
    private SessionWaitlistRepository sessionWaitlistRepository;

    @MockBean
    private BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;

    @MockBean
    private MeterRegistry meterRegistry;

    @MockBean
    private ProfileCompletionGuard profileCompletionGuard;

    // ── Security infrastructure beans ─────────────────────

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private EndpointRateLimitFilter endpointRateLimitFilter;

    @MockBean
    private RequestTraceFilter requestTraceFilter;

    @MockBean
    private MaintenanceModeFilter maintenanceModeFilter;


    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private com.mentorly.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockBean
    private com.mentorly.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private static final User LEARNER = createUser(11L, UserRole.LEARNER, "Learner One");
    private static final User MENTOR = createUser(20L, UserRole.MENTOR, "Mentor One");
    private static final User ADMIN = createUser(1L, UserRole.ADMIN, "Admin");

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ═══════════════════════════════════════════════════════
    //  POST /api/v1/bookings — createBooking
    // ═══════════════════════════════════════════════════════

    @Test
    void createBookingRejectsMentorCaller() throws Exception {
        setSecurityContext(MENTOR);

        when(bookingLifecycleService.createBooking(eq(MENTOR), anyString(), any(BookingRequest.class)))
                .thenThrow(new IllegalArgumentException("Only learners can create bookings"));

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "booking-test-key-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 1}
                                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Request failed"))
                .andExpect(jsonPath("$.data.error").value("Only learners can create bookings"));
    }

    @Test
    void createBookingRejectsInvalidIdempotencyKeyFormat() throws Exception {
        setSecurityContext(LEARNER);

        when(bookingLifecycleService.createBooking(eq(LEARNER), anyString(), any(BookingRequest.class)))
                .thenThrow(new IllegalArgumentException(
                        "Idempotency-Key header format is invalid (allowed: letters, numbers, . _ : -)"));

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "bad key!")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 99}
                                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Idempotency-Key header format is invalid (allowed: letters, numbers, . _ : -)"));
    }

    @Test
    void createBookingRejectsIdempotencyKeyLengthOutsideRange() throws Exception {
        setSecurityContext(LEARNER);

        when(bookingLifecycleService.createBooking(eq(LEARNER), anyString(), any(BookingRequest.class)))
                .thenThrow(new IllegalArgumentException("Idempotency-Key header must be 8-120 characters"));

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "short")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 99}
                                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Idempotency-Key header must be 8-120 characters"));
    }

    @Test
    void createBookingReturnsSuccessForLearner() throws Exception {
        setSecurityContext(LEARNER);

        Booking booking = createBooking(123L, null, LEARNER, BookingStatus.PENDING);
        when(bookingLifecycleService.createBooking(eq(LEARNER), anyString(), any(BookingRequest.class)))
                .thenReturn(booking);

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "booking-test-key-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 99}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Booking created"))
                .andExpect(jsonPath("$.data.id").value(123));
    }

    @Test
    void createBookingReturnsRetryableConflictOnTransientWriteConflict() throws Exception {
        setSecurityContext(LEARNER);

        when(bookingLifecycleService.createBooking(eq(LEARNER), anyString(), any(BookingRequest.class)))
                .thenThrow(new ApiClientException(HttpStatus.CONFLICT,
                        "BOOKING_TEMPORARY_CONFLICT",
                        "Temporary booking conflict. Please retry.",
                        true));

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "booking-test-conflict")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 99}
                                        """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.data.code").value("BOOKING_TEMPORARY_CONFLICT"))
                .andExpect(jsonPath("$.data.retryable").value(true));
    }

    @Test
    void createBookingReplaysByIdempotencyKey() throws Exception {
        setSecurityContext(LEARNER);

        Booking existingBooking = new Booking();
        existingBooking.setId(456L);
        existingBooking.setBookingStatus(BookingStatus.PENDING);

        when(bookingLifecycleService.createBooking(eq(LEARNER), anyString(), any(BookingRequest.class)))
                .thenReturn(existingBooking);

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "booking-test-replay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 99}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Booking created"))
                .andExpect(jsonPath("$.data.id").value(456));
    }

    @Test
    void createBookingRejectsIdempotencyPayloadMismatch() throws Exception {
        setSecurityContext(LEARNER);

        when(bookingLifecycleService.createBooking(eq(LEARNER), anyString(), any(BookingRequest.class)))
                .thenThrow(new IllegalArgumentException("Idempotency key reuse with different payload"));

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Idempotency-Key", "booking-test-mismatch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"sessionId": 99}
                                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Idempotency key reuse with different payload"));
    }

    // ═══════════════════════════════════════════════════════
    //  POST /api/v1/bookings/{id}/confirm — confirmBooking
    // ═══════════════════════════════════════════════════════

    @Test
    void confirmBookingReturnsSuccess() throws Exception {
        setSecurityContext(MENTOR);

        Booking booking = buildBooking(700L, LEARNER, MENTOR, BookingStatus.PENDING);
        when(bookingLifecycleService.confirmBooking(700L, MENTOR)).thenReturn(booking);

        mockMvc.perform(post("/api/v1/bookings/700/confirm")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Booking confirmed"))
                .andExpect(jsonPath("$.data.bookingStatus").value("PENDING"));
    }

    // ═══════════════════════════════════════════════════════
    //  POST /api/v1/bookings/{id}/start — startBooking
    // ═══════════════════════════════════════════════════════

    @Test
    void startBookingReturnsSuccess() throws Exception {
        setSecurityContext(MENTOR);

        Booking booking = buildBooking(700L, LEARNER, MENTOR, BookingStatus.CONFIRMED);
        when(bookingLifecycleService.startBooking(700L, MENTOR)).thenReturn(booking);

        mockMvc.perform(post("/api/v1/bookings/700/start")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Booking started"))
                .andExpect(jsonPath("$.data.bookingStatus").value("CONFIRMED"));
    }

    @Test
    void startBookingRejectsUnrelatedUser() throws Exception {
        User otherUser = createUser(99L, UserRole.LEARNER, "Other Learner");
        setSecurityContext(otherUser);

        when(bookingLifecycleService.startBooking(700L, otherUser))
                .thenThrow(new IllegalArgumentException(
                        "Only the session mentor, assigned learner, or an admin can start a booking"));

        mockMvc.perform(post("/api/v1/bookings/700/start")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Only the session mentor, assigned learner, or an admin can start a booking"));
    }

    // ═══════════════════════════════════════════════════════
    //  POST /api/v1/bookings/{id}/complete — completeBooking
    // ═══════════════════════════════════════════════════════

    @Test
    void completeBookingReturnsSuccess() throws Exception {
        setSecurityContext(MENTOR);

        Booking booking = buildBooking(700L, LEARNER, MENTOR, BookingStatus.IN_PROGRESS);
        when(bookingLifecycleService.completeBooking(700L, MENTOR)).thenReturn(booking);

        mockMvc.perform(post("/api/v1/bookings/700/complete")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Booking completed"))
                .andExpect(jsonPath("$.data.bookingStatus").value("IN_PROGRESS"));
    }

    @Test
    void completeBookingRejectsNonParticipant() throws Exception {
        User otherUser = createUser(99L, UserRole.LEARNER, "Other Learner");
        setSecurityContext(otherUser);

        when(bookingLifecycleService.completeBooking(700L, otherUser))
                .thenThrow(new IllegalArgumentException("Only the learner or mentor can complete a booking"));

        mockMvc.perform(post("/api/v1/bookings/700/complete")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Only the learner or mentor can complete a booking"));
    }

    // ═══════════════════════════════════════════════════════
    //  POST /api/v1/bookings/{id}/cancel — cancelBooking
    // ═══════════════════════════════════════════════════════

    @Test
    void cancelBookingReturnsSuccess() throws Exception {
        setSecurityContext(LEARNER);

        Booking booking = buildBooking(700L, LEARNER, MENTOR, BookingStatus.PENDING);
        when(bookingLifecycleService.cancelBooking(700L, LEARNER)).thenReturn(booking);

        mockMvc.perform(post("/api/v1/bookings/700/cancel")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Booking cancelled"))
                .andExpect(jsonPath("$.data.bookingStatus").value("PENDING"));
    }

    // ═══════════════════════════════════════════════════════
    //  PATCH /api/v1/bookings/{id}/status — updateStatus
    // ═══════════════════════════════════════════════════════

    @Test
    void updateStatusAcceptsBooking() throws Exception {
        setSecurityContext(MENTOR);

        Booking booking = buildBooking(700L, LEARNER, MENTOR, BookingStatus.ACCEPTED);
        when(bookingLifecycleService.handleStatusUpdate(eq(700L), eq(MENTOR), eq(BookingStatus.ACCEPTED), eq(emailService)))
                .thenReturn(booking);

        mockMvc.perform(patch("/api/v1/bookings/700/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"status":"ACCEPTED"}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingStatus").value("ACCEPTED"));
    }

    @Test
    void updateStatusCompletesBookingByMentor() throws Exception {
        setSecurityContext(MENTOR);

        Booking completedBooking = buildBooking(701L, LEARNER, MENTOR, BookingStatus.COMPLETED);
        when(bookingLifecycleService.handleStatusUpdate(eq(701L), eq(MENTOR), eq(BookingStatus.COMPLETED), eq(emailService)))
                .thenReturn(completedBooking);

        mockMvc.perform(patch("/api/v1/bookings/701/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"status":"COMPLETED"}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Status updated"))
                .andExpect(jsonPath("$.data.bookingStatus").value("COMPLETED"));
    }

    @Test
    void updateStatusRejectsCompletedByLearner() throws Exception {
        setSecurityContext(LEARNER);

        when(bookingLifecycleService.handleStatusUpdate(eq(700L), eq(LEARNER), eq(BookingStatus.COMPLETED), eq(emailService)))
                .thenThrow(new IllegalArgumentException("Only the learner or mentor can complete a booking"));

        mockMvc.perform(patch("/api/v1/bookings/700/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"status":"COMPLETED"}
                                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value("Only the learner or mentor can complete a booking"));
    }

    @Test
    void updateStatusCancelsBooking() throws Exception {
        setSecurityContext(LEARNER);

        Booking cancelledBooking = buildBooking(702L, LEARNER, MENTOR, BookingStatus.CANCELLED);
        when(bookingLifecycleService.handleStatusUpdate(eq(702L), eq(LEARNER), eq(BookingStatus.CANCELLED), eq(emailService)))
                .thenReturn(cancelledBooking);

        mockMvc.perform(patch("/api/v1/bookings/702/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"status":"CANCELLED"}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingStatus").value("CANCELLED"));
    }

    @Test
    void updateStatusAllowsTransitionByAdmin() throws Exception {
        setSecurityContext(ADMIN);

        Booking cancelledBooking = buildBooking(702L, LEARNER, MENTOR, BookingStatus.CANCELLED);
        when(bookingLifecycleService.handleStatusUpdate(eq(702L), eq(ADMIN), eq(BookingStatus.CANCELLED), eq(emailService)))
                .thenReturn(cancelledBooking);

        mockMvc.perform(patch("/api/v1/bookings/702/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                        {"status":"CANCELLED"}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingStatus").value("CANCELLED"));
    }

    // ═══════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════

    private static void setSecurityContext(User user) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    private static User createUser(Long id, UserRole role, String name) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setFullName(name);
        return user;
    }

    private static SkillSession createSession(Long id, User mentor, String title, BigDecimal price) {
        SkillSession session = new SkillSession();
        session.setId(id);
        session.setMentor(mentor);
        session.setTitle(title);
        session.setMaxParticipants(2);
        session.setStartTime(OffsetDateTime.now().plusDays(1));
        session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
        session.setPriceAmount(price);
        return session;
    }

    private static Booking createBooking(Long id, SkillSession session, User learner, BookingStatus status) {
        Booking booking = new Booking();
        booking.setId(id);
        booking.setSession(session);
        booking.setLearner(learner);
        booking.setBookingStatus(status);
        return booking;
    }

    private static Booking buildBooking(Long bookingId, User learner, User mentor, BookingStatus status) {
        SkillSession session = new SkillSession();
        session.setId(501L);
        session.setMentor(mentor);
        session.setTitle("Advanced Java");
        session.setStartTime(OffsetDateTime.now().minusHours(2));
        session.setEndTime(OffsetDateTime.now().minusHours(1));
        session.setPriceAmount(new BigDecimal("100.00"));
        session.setMaxParticipants(2);

        Booking booking = new Booking();
        booking.setId(bookingId);
        booking.setLearner(learner);
        booking.setSession(session);
        booking.setBookingStatus(status);
        return booking;
    }
}
