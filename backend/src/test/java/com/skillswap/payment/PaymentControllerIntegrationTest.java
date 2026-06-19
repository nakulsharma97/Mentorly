package com.skillswap.payment;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PaymentController.class)
@AutoConfigureMockMvc(addFilters = false)
class PaymentControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PaymentRepository paymentRepository;
    @MockitoBean
    private BookingRepository bookingRepository;
    @MockitoBean
    private NotificationService notificationService;
    @MockitoBean
    private PaymentIdempotencyKeyRepository paymentIdempotencyKeyRepository;
    @MockitoBean
    private MeterRegistry meterRegistry;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;

    @MockitoBean
    private RequestTraceFilter requestTraceFilter;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @Test
    void createIntentRejectsMentorCaller() throws Exception {
        User mentorCaller = new User();
        mentorCaller.setId(20L);
        mentorCaller.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentorCaller, null,
                mentorCaller.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(post("/api/v1/payments/intent")
                    .header("Idempotency-Key", "test-key-1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "bookingId": 1,
                              "amount": 10.0,
                              "mode": "CARD"
                            }
                            """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Only learners can create payment intents"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void createIntentReturnsSuccessForLearner() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                learner.getAuthorities()));
        SecurityContextHolder.setContext(context);

        User mentor = new User();
        mentor.setId(31L);

        SkillSession session = new SkillSession();
        session.setMentor(mentor);

        Booking booking = new Booking();
        booking.setId(88L);
        booking.setLearner(learner);
        booking.setSession(session);

        Payment payment = new Payment();
        payment.setId(501L);
        payment.setBooking(booking);
        payment.setMode("CARD");
        payment.setStatus(PaymentStatus.INITIATED);

        when(bookingRepository.findById(88L)).thenReturn(Optional.of(booking));
        when(paymentRepository.save(any(Payment.class))).thenReturn(payment);
        when(paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                anyString()))
                .thenReturn(Optional.empty());

        try {
            mockMvc.perform(post("/api/v1/payments/intent")
                    .header("Idempotency-Key", "test-key-2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "bookingId": 88,
                              "amount": 12.50,
                              "mode": "CARD"
                            }
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Payment intent created"))
                    .andExpect(jsonPath("$.data.id").value(501))
                    .andExpect(jsonPath("$.data.status").value("INITIATED"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void createIntentReplaysByIdempotencyKey() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                learner.getAuthorities()));
        SecurityContextHolder.setContext(context);

        Payment existing = new Payment();
        existing.setId(900L);
        existing.setStatus(PaymentStatus.INITIATED);

        PaymentIdempotencyKey key = new PaymentIdempotencyKey();
        key.setRequestHash("88|12.50|CARD");
        key.setPayment(existing);

        when(paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                anyString()))
                .thenReturn(Optional.of(key));

        try {
            mockMvc.perform(post("/api/v1/payments/intent")
                    .header("Idempotency-Key", "test-key-replay")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "bookingId": 88,
                              "amount": 12.50,
                              "mode": "CARD"
                            }
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Payment intent replayed"))
                    .andExpect(jsonPath("$.data.id").value(900));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void updateStatusRejectsLearnerCaller() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        User mentor = new User();
        mentor.setId(31L);
        mentor.setRole(UserRole.MENTOR);

        Payment payment = buildPayment(601L, learner, mentor, PaymentStatus.INITIATED);
        when(paymentRepository.findById(601L)).thenReturn(Optional.of(payment));
        when(paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                anyString()))
                .thenReturn(Optional.empty());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null, learner.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(patch("/api/v1/payments/601/status")
                    .header("Idempotency-Key", "test-key-3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"status":"ESCROWED"}
                            """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Only the session mentor can update payment status"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void updateStatusAllowsMentorCaller() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        User mentor = new User();
        mentor.setId(31L);
        mentor.setRole(UserRole.MENTOR);

        Payment payment = buildPayment(602L, learner, mentor, PaymentStatus.INITIATED);
        when(paymentRepository.findById(602L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                anyString()))
                .thenReturn(Optional.empty());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null, mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(patch("/api/v1/payments/602/status")
                    .header("Idempotency-Key", "test-key-4")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"status":"ESCROWED"}
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Payment status updated"))
                    .andExpect(jsonPath("$.data.status").value("ESCROWED"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void updateStatusAllowsAdminCaller() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        User mentor = new User();
        mentor.setId(31L);
        mentor.setRole(UserRole.MENTOR);

        User admin = new User();
        admin.setId(1L);
        admin.setRole(UserRole.ADMIN);

        Payment payment = buildPayment(603L, learner, mentor, PaymentStatus.INITIATED);
        when(paymentRepository.findById(603L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                anyString()))
                .thenReturn(Optional.empty());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(patch("/api/v1/payments/603/status")
                    .header("Idempotency-Key", "test-key-5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                                    {"status":"RELEASED"}
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("RELEASED"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static Payment buildPayment(Long paymentId, User learner, User mentor, PaymentStatus status) {
        SkillSession session = new SkillSession();
        session.setMentor(mentor);

        Booking booking = new Booking();
        booking.setId(777L);
        booking.setLearner(learner);
        booking.setSession(session);

        Payment payment = new Payment();
        payment.setId(paymentId);
        payment.setBooking(booking);
        payment.setMode("CARD");
        payment.setStatus(status);
        return payment;
    }
}
