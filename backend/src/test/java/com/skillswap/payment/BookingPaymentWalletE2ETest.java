package com.skillswap.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.wallet.WalletService;
import com.skillswap.wallet.WalletTransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@org.springframework.test.context.TestPropertySource(properties = {
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.auth.cookies.secure=false",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545",
        "spring.datasource.url=jdbc:h2:mem:booking-payment-wallet-e2e;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false"
})
class BookingPaymentWalletE2ETest {

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private WalletService walletService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String defaultPassword;

    @BeforeEach
    void setUp() {
        defaultPassword = "Password123!";
    }

    /**
     * Full E2E: Learner creates booking → Mentor accepts → wallet debited (escrow)
     * → Start session → Complete session → mentor credited (payout after 10% fee)
     * → Verify all payment/wallet states.
     */
    @Test
    @Transactional
    @Rollback
    void givenFullBookingLifecycle_whenCompleted_thenPaymentAndWalletStatesAreCorrect() throws Exception {
        // ── Setup ──
        User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
        User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);

        BigDecimal sessionPrice = new BigDecimal("200.00");
        SkillSession session = createSession(mentor, sessionPrice,
                OffsetDateTime.now().minusHours(3),
                OffsetDateTime.now().minusHours(1));

        // Credit the learner's wallet with sufficient balance
        BigDecimal initialWallet = new BigDecimal("500.00");
        creditWallet(learner.getId(), initialWallet);

        String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
        String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);

        // Verify initial balances
        assertThat(walletService.balance(reloadUser(learner.getId())).balance())
                .isEqualByComparingTo(initialWallet);
        assertThat(walletService.balance(reloadUser(mentor.getId())).balance())
                .isEqualByComparingTo(BigDecimal.ZERO);

        // ── Step 1: Learner creates a booking ──
        Long bookingId = createBooking(session.getId(), learnerToken, "e2e-test-key-1");

        Booking booking = bookingRepository.findById(bookingId).orElseThrow();
        assertThat(booking.getBookingStatus()).isEqualTo(BookingStatus.PENDING);
        assertThat(booking.getPayment()).isNull();

        // ── Step 2: Mentor accepts → wallet debited, payment escrowed ──
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"ACCEPTED"}
                                """))
                .andExpect(status().isOk());

        // Verify learner wallet was debited
        BigDecimal expectedAfterEscrow = initialWallet.subtract(sessionPrice);
        assertThat(walletService.balance(reloadUser(learner.getId())).balance())
                .isEqualByComparingTo(expectedAfterEscrow);

        // Verify payment is ESCROWED and linked to booking
        Booking acceptedBooking = bookingRepository.findById(bookingId).orElseThrow();
        assertThat(acceptedBooking.getBookingStatus()).isEqualTo(BookingStatus.ACCEPTED);
        assertThat(acceptedBooking.getPayment()).isNotNull();

        Payment escrowedPayment = acceptedBooking.getPayment();
        assertThat(escrowedPayment.getStatus()).isEqualTo(PaymentStatus.ESCROWED);
        assertThat(escrowedPayment.getAmount()).isEqualByComparingTo(sessionPrice);
        assertThat(escrowedPayment.getLearnerId()).isEqualTo(learner.getId());
        assertThat(escrowedPayment.getMentorId()).isEqualTo(mentor.getId());
        assertThat(escrowedPayment.getGateway()).isEqualTo("wallet");

        // Mentor balance should still be 0 (funds are escrowed, not released yet)
        assertThat(walletService.balance(reloadUser(mentor.getId())).balance())
                .isEqualByComparingTo(BigDecimal.ZERO);

        // ── Step 3: Start the booking ──
        mockMvc.perform(post("/api/v1/bookings/{id}/start", bookingId)
                        .with(csrf())
                        .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken)))
                .andExpect(status().isOk());

        Booking startedBooking = bookingRepository.findById(bookingId).orElseThrow();
        assertThat(startedBooking.getBookingStatus()).isEqualTo(BookingStatus.IN_PROGRESS);

        // Wallet balances should not change during start
        assertThat(walletService.balance(reloadUser(learner.getId())).balance())
                .isEqualByComparingTo(expectedAfterEscrow);
        assertThat(walletService.balance(reloadUser(mentor.getId())).balance())
                .isEqualByComparingTo(BigDecimal.ZERO);

        // ── Step 4: Complete the booking → payment released, mentor paid ──
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"COMPLETED"}
                                """))
                .andExpect(status().isOk());

        // Verify booking is COMPLETED
        Booking completedBooking = bookingRepository.findById(bookingId).orElseThrow();
        assertThat(completedBooking.getBookingStatus()).isEqualTo(BookingStatus.COMPLETED);

        // Verify payment status is RELEASED
        Payment releasedPayment = paymentRepository.findById(escrowedPayment.getId()).orElseThrow();
        assertThat(releasedPayment.getStatus()).isEqualTo(PaymentStatus.RELEASED);

        // Verify mentor received payout (session price - 10% fee)
        BigDecimal expectedFee = sessionPrice.multiply(BigDecimal.valueOf(0.10))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal expectedPayout = sessionPrice.subtract(expectedFee);
        assertThat(walletService.balance(reloadUser(mentor.getId())).balance())
                .isEqualByComparingTo(expectedPayout);

        // Verify learner wallet is unchanged (still debited from escrow)
        assertThat(walletService.balance(reloadUser(learner.getId())).balance())
                .isEqualByComparingTo(expectedAfterEscrow);
    }

    /**
     * Verify the wallet balance approach: create a booking, accept it, cancel it,
     * and confirm the learner gets a full refund.
     */
    @Test
    @Transactional
    @Rollback
    void givenAcceptedBooking_whenCancelled_thenLearnerReceivesFullRefund() throws Exception {
        User mentor = createUser(uniqueEmail("cancelled-mentor"), UserRole.MENTOR);
        User learner = createUser(uniqueEmail("cancelled-learner"), UserRole.LEARNER);

        BigDecimal sessionPrice = new BigDecimal("150.00");
        SkillSession session = createSession(mentor, sessionPrice,
                OffsetDateTime.now().plusDays(2),
                OffsetDateTime.now().plusDays(2).plusHours(1));

        BigDecimal initialWallet = new BigDecimal("300.00");
        creditWallet(learner.getId(), initialWallet);

        String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
        String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);

        Long bookingId = createBooking(session.getId(), learnerToken, "e2e-cancel-key-1");

        // Accept
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"ACCEPTED"}
                                """))
                .andExpect(status().isOk());

        // Verify escrowed
        assertThat(walletService.balance(reloadUser(learner.getId())).balance())
                .isEqualByComparingTo(initialWallet.subtract(sessionPrice));
        Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.ESCROWED);

        // Cancel
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"CANCELLED"}
                                """))
                .andExpect(status().isOk());

        // Verify full refund to learner wallet
        assertThat(walletService.balance(reloadUser(learner.getId())).balance())
                .isEqualByComparingTo(initialWallet);

        // Verify payment is REFUNDED
        Payment refundedPayment = paymentRepository.findById(payment.getId()).orElseThrow();
        assertThat(refundedPayment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);

        // Verify mentor never received anything
        assertThat(walletService.balance(reloadUser(mentor.getId())).balance())
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    // ── Helpers ──

    private User createUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(defaultPassword));
        user.setRole(role);
        user.setReferralCode("E2E-" + UUID.randomUUID());
        user.setFullName(role.name() + " User " + UUID.randomUUID());
        user.setEnabled(true);
        return userRepository.save(user);
    }

    private SkillSession createSession(User mentor, BigDecimal price, OffsetDateTime start, OffsetDateTime end) {
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle("E2E Session " + UUID.randomUUID());
        session.setDescription("E2E test session description");
        session.setSessionType("ONLINE");
        session.setStartTime(start);
        session.setEndTime(end);
        session.setPriceAmount(price);
        session.setMeetingLink("https://example.com/meeting/" + UUID.randomUUID());
        session.setMaxParticipants(1);
        return sessionRepository.save(session);
    }

    private void creditWallet(Long userId, BigDecimal amount) {
        walletService.addEntryForUser(userId, new WalletService.WalletEntryRequest(
                WalletTransactionType.CREDIT,
                amount,
                "CREDITS",
                "E2E test credit",
                "TEST",
                userId));
    }

    private Long createBooking(Long sessionId, String learnerToken, String idempotencyKey) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/bookings")
                        .with(csrf())
                        .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sessionId": %d}
                                """.formatted(sessionId)))
                .andReturn();

        int responseStatus = result.getResponse().getStatus();
        if (responseStatus != 200) {
            String body = result.getResponse().getContentAsString();
            throw new AssertionError("Create booking failed with status %d. response=%s".formatted(responseStatus, body));
        }

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return root.path("data").path("id").asLong();
    }

    private String loginAndGetJwtToken(String email, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();

        List<String> setCookies = loginResult.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        return setCookies.stream()
                .filter(cookie -> cookie.startsWith("access_token="))
                .findFirst()
                .map(cookie -> cookie.substring("access_token=".length(), cookie.indexOf(';')))
                .orElseThrow(() -> new IllegalStateException("Access token cookie not found after login"));
    }

    private User reloadUser(Long userId) {
        return userRepository.findById(userId).orElseThrow();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String uniqueEmail(String prefix) {
        return prefix + "+" + UUID.randomUUID() + "@example.com";
    }
}
