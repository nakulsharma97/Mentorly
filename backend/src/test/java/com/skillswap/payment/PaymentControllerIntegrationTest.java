package com.skillswap.payment;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
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
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    private PaymentService paymentService;
    @MockitoBean
    private PaymentVerificationService paymentVerificationService;
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
    private ProfileCompletionGuard profileCompletionGuard;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;

    @MockitoBean
    private RequestTraceFilter requestTraceFilter;

    @MockitoBean
    private MaintenanceModeFilter maintenanceModeFilter;


    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @Test
    void createIntentRejectsMentorCaller() throws Exception {
        User mentorCaller = new User();
        mentorCaller.setId(20L);
        mentorCaller.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentorCaller, null,
                mentorCaller.getAuthorities()));
        SecurityContextHolder.setContext(context);

        when(paymentService.createPaymentOrder(any(User.class), anyString(), anyLong(), any(), anyString()))
                .thenThrow(new IllegalArgumentException("Only learners can create payment intents"));

        try {
            mockMvc.perform(post("/api/v1/payments/intent")
                    .header("Idempotency-Key", "test-key-1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "bookingId": 1,
                              "amount": 10.0,
                              "gateway": "razorpay"
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
        payment.setLearnerId(11L);
        payment.setMentorId(31L);
        payment.setSessionId(88L);
        payment.setAmount(new java.math.BigDecimal("12.50"));
        payment.setGateway("razorpay");
        payment.setStatus(PaymentStatus.INITIATED);

        when(paymentService.createPaymentOrder(any(User.class), anyString(), anyLong(), any(), anyString()))
                .thenReturn(payment);

        try {
            mockMvc.perform(post("/api/v1/payments/intent")
                    .header("Idempotency-Key", "test-key-2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "bookingId": 88,
                              "amount": 12.50,
                              "gateway": "razorpay"
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
    void verifyPaymentReturnsSuccess() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                learner.getAuthorities()));
        SecurityContextHolder.setContext(context);

        Payment payment = new Payment();
        payment.setId(601L);
        payment.setPaymentId("pay_test_123");
        payment.setStatus(PaymentStatus.ESCROWED);

        when(paymentVerificationService.verifyPayment(anyLong(), anyString(), anyString(), any(), any(User.class)))
                .thenReturn(payment);

        try {
            mockMvc.perform(post("/api/v1/payments/verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "paymentId": 601,
                              "gatewayPaymentId": "pay_test_123",
                              "signature": "test_signature",
                              "extraParams": {
                                "razorpay_order_id": "order_test_123"
                              }
                            }
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Payment verified"))
                    .andExpect(jsonPath("$.data.status").value("ESCROWED"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void processRefundReturnsSuccess() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                learner.getAuthorities()));
        SecurityContextHolder.setContext(context);

        Payment payment = new Payment();
        payment.setId(701L);
        payment.setStatus(PaymentStatus.REFUNDED);

        when(paymentService.refundPayment(anyLong(), any(), anyString(), any(User.class))).thenReturn(payment);

        try {
            mockMvc.perform(post("/api/v1/payments/701/refund")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "amount": 10.00,
                              "reason": "Customer requested"
                            }
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Refund processed"))
                    .andExpect(jsonPath("$.data.status").value("REFUNDED"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void stripeWebhookWithValidSignatureProcessesEvent() throws Exception {
        PaymentGateway gateway = mock(PaymentGateway.class);
        when(gateway.verifyWebhookSignature(anyString(), anyString())).thenReturn(true);
        when(paymentService.resolveGateway("stripe")).thenReturn(gateway);

        Payment payment = new Payment();
        payment.setId(900L);
        payment.setStatus(PaymentStatus.ESCROWED);
        when(paymentVerificationService.processWebhookEvent(
                eq("stripe"), eq("payment_intent.succeeded"), eq("pi_123"), any()))
                .thenReturn(payment);

        mockMvc.perform(post("/api/v1/payments/webhook/stripe")
                .header("Stripe-Signature", "t=1700000000,v1=signature")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "type": "payment_intent.succeeded",
                          "data": { "object": { "id": "pi_123" } }
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Webhook processed"))
                .andExpect(jsonPath("$.data.status").value("ESCROWED"));
    }

    @Test
    void stripeWebhookWithInvalidSignatureRejectedWith400() throws Exception {
        PaymentGateway gateway = mock(PaymentGateway.class);
        when(gateway.verifyWebhookSignature(anyString(), anyString())).thenReturn(false);
        when(paymentService.resolveGateway("stripe")).thenReturn(gateway);

        mockMvc.perform(post("/api/v1/payments/webhook/stripe")
                .header("Stripe-Signature", "t=1700000000,v1=forged")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "type": "payment_intent.succeeded",
                          "data": { "object": { "id": "pi_123" } }
                        }
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value("Invalid webhook signature"));

        // Rejection must happen at the signature gate — the payload must never
        // reach payment processing. Stripe retries a failed webhook, so a
        // forged event must not accidentally mark a payment captured.
        verify(paymentVerificationService, never())
                .processWebhookEvent(anyString(), anyString(), anyString(), any());
    }

    @Test
    void getPaymentByIdReturnsPayment() throws Exception {
        User learner = new User();
        learner.setId(11L);
        learner.setRole(UserRole.LEARNER);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                learner.getAuthorities()));
        SecurityContextHolder.setContext(context);

        Payment payment = new Payment();
        payment.setId(801L);
        payment.setStatus(PaymentStatus.INITIATED);

        // Ownership is enforced in the service layer; the controller simply
        // passes the authenticated user through.
        when(paymentService.getPayment(anyLong(), any(User.class))).thenReturn(payment);

        try {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/payments/801")
                    .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Payment fetched"))
                    .andExpect(jsonPath("$.data.id").value(801));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
