package com.skillswap.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SessionType;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full-context integration tests for the production-grade refund workflow.
 *
 * <p>Verifies that the database status is only flipped to {@code REFUNDED}
 * AFTER the payment gateway confirms the refund, that a gateway failure rolls
 * back the transaction (DB stays {@code ESCROWED}), that duplicate refunds are
 * prevented, and that the admin refund endpoint wires through the same
 * gateway-first path.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:refund-workflow-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.auth.cookies.secure=false",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545"
})
@Transactional
@Rollback
class RefundWorkflowIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    /** Mocked Razorpay adapter so gateway success/failure is deterministic. */
    @MockBean
    private RazorpayAdapter razorpayAdapter;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User learner;
    private User mentor;

    @BeforeEach
    void setUp() {
        learner = createUser("learner+" + UUID.randomUUID() + "@example.com", UserRole.LEARNER);
        mentor = createUser("mentor+" + UUID.randomUUID() + "@example.com", UserRole.MENTOR);
        // The mocked adapter must still resolve by slug inside PaymentService.
        when(razorpayAdapter.getGatewaySlug()).thenReturn("razorpay");
    }

    // ── 1. Gateway success: DB flips only AFTER the gateway confirms ──

    @Test
    void givenEscrowedRazorpayPayment_whenRefunded_thenGatewayCalledAndStatusRefunded() {
        Payment payment = persistPayment("razorpay", "pay_rzp_1", PaymentStatus.ESCROWED);
        when(razorpayAdapter.processRefund(eq("pay_rzp_1"), eq(new BigDecimal("100.00")), anyString()))
                .thenReturn("rfnd_rzp_1");

        Payment result = paymentService.refundForCancellation(
                payment.getId(), new BigDecimal("100.00"), "Booking cancelled");

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(razorpayAdapter).processRefund("pay_rzp_1", new BigDecimal("100.00"), "Booking cancelled");
        assertThat(paymentRepository.findById(payment.getId()).orElseThrow().getStatus())
                .isEqualTo(PaymentStatus.REFUNDED);
    }

    // ── 2. Gateway failure: transaction rolls back, DB stays ESCROWED ──

    @Test
    void givenGatewayFailure_whenRefundAttempted_thenExceptionAndPaymentStaysEscrowed() {
        Payment payment = persistPayment("razorpay", "pay_rzp_2", PaymentStatus.ESCROWED);
        when(razorpayAdapter.processRefund(anyString(), any(), anyString()))
                .thenThrow(new IllegalStateException("Gateway unavailable"));

        assertThatThrownBy(() -> paymentService.refundForCancellation(
                payment.getId(), new BigDecimal("100.00"), "Booking cancelled"))
                .isInstanceOf(IllegalStateException.class);

        // Rollback — the DB status must NOT be marked REFUNDED.
        assertThat(paymentRepository.findById(payment.getId()).orElseThrow().getStatus())
                .isEqualTo(PaymentStatus.ESCROWED);
    }

    // ── 3. Duplicate refunds are prevented ──

    @Test
    void givenRefundedPayment_whenRefundedAgain_thenGatewayCalledOnlyOnce() {
        Payment payment = persistPayment("razorpay", "pay_rzp_3", PaymentStatus.ESCROWED);
        when(razorpayAdapter.processRefund(eq("pay_rzp_3"), any(), anyString()))
                .thenReturn("rfnd_rzp_3");

        paymentService.refundForCancellation(payment.getId(), new BigDecimal("100.00"), "Booking cancelled");
        paymentService.refundForCancellation(payment.getId(), new BigDecimal("100.00"), "Booking cancelled");

        verify(razorpayAdapter, times(1)).processRefund(eq("pay_rzp_3"), any(), anyString());
        assertThat(paymentRepository.findById(payment.getId()).orElseThrow().getStatus())
                .isEqualTo(PaymentStatus.REFUNDED);
    }

    // ── 4. Wallet escrow: no external gateway call, status flips internally ──

    @Test
    void givenWalletEscrowPayment_whenRefunded_thenNoExternalGatewayCall() {
        Payment payment = persistPayment("wallet", null, PaymentStatus.ESCROWED);

        Payment result = paymentService.refundForCancellation(
                payment.getId(), new BigDecimal("100.00"), "Booking cancelled");

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        verify(razorpayAdapter, never()).processRefund(anyString(), any(), anyString());
    }

    // ── 5. Admin refund endpoint routes through the gateway-first path ──

    @Test
    void givenAdminRefundRequest_whenPaymentEscrowed_thenGatewayCalledAndRefunded() throws Exception {
        Payment payment = persistPayment("razorpay", "pay_rzp_4", PaymentStatus.ESCROWED);
        when(razorpayAdapter.processRefund(eq("pay_rzp_4"), eq(new BigDecimal("100.00")), anyString()))
                .thenReturn("rfnd_rzp_4");

        User admin = createUser("admin+" + UUID.randomUUID() + "@example.com", UserRole.ADMIN);

        mockMvc.perform(post("/api/v1/admin/payments/{id}/refund", payment.getId())
                        .with(csrf())
                        .with(user(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Integration test refund\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUNDED"));

        verify(razorpayAdapter).processRefund("pay_rzp_4", new BigDecimal("100.00"), "Integration test refund");
        assertThat(paymentRepository.findById(payment.getId()).orElseThrow().getStatus())
                .isEqualTo(PaymentStatus.REFUNDED);
    }

    // ── Helpers ──

    private Payment persistPayment(String gateway, String paymentId, PaymentStatus status) {
        Payment payment = Payment.builder()
                .orderId("IT_" + UUID.randomUUID().toString().replace("-", ""))
                .paymentId(paymentId)
                .learnerId(learner.getId())
                .mentorId(mentor.getId())
                .sessionId(createSession().getId())
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .gateway(gateway)
                .status(status)
                .createdAt(OffsetDateTime.now())
                .build();
        return paymentRepository.save(payment);
    }

    private SkillSession createSession() {
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle("Refund IT Session " + UUID.randomUUID().toString().substring(0, 8));
        session.setSessionType(SessionType.PUBLIC);
        session.setStartTime(OffsetDateTime.now().minusDays(1));
        session.setEndTime(OffsetDateTime.now().plusHours(1));
        session.setPriceAmount(new BigDecimal("100.00"));
        session.setMaxParticipants(1);
        return sessionRepository.save(session);
    }

    private User createUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "")
                + UUID.randomUUID().toString().substring(0, 4));
        user.setFullName(role.name() + " User " + UUID.randomUUID().toString().substring(0, 8));
        user.setEnabled(true);
        return userRepository.save(user);
    }
}
