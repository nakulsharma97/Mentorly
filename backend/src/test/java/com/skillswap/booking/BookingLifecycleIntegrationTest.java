package com.skillswap.booking;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SessionType;
import com.skillswap.session.SkillSession;
import com.skillswap.user.MentorVerificationStatus;
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
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:booking-lifecycle-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class BookingLifecycleIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @MockBean
    private ProfileCompletionGuard profileCompletionGuard;

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

    private User mentor;
    private User learner;
    private User learner2;
    private SkillSession futureSession;
    private SkillSession pastSession;

    @BeforeEach
    void setUp() {
        mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
        learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
        learner2 = createUser(uniqueEmail("learner2"), UserRole.LEARNER);

        // Session with future start time (for creating bookings)
        futureSession = createSession(mentor, new BigDecimal("100.00"),
                OffsetDateTime.now().plusDays(2),
                OffsetDateTime.now().plusDays(2).plusHours(1));

        // Session with past times (for starting and completing)
        pastSession = createSession(mentor, new BigDecimal("100.00"),
                OffsetDateTime.now().minusHours(3),
                OffsetDateTime.now().minusHours(1));
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 1: Full booking lifecycle
    //  create → accept (escrow) → start → complete (release)
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenLearnerWithBalance_whenBookingLifecycleCompleted_thenWalletTransferredCorrectly() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        Long bookingId = createBooking(pastSession.getId(), learner);

        // Mentor accepts → wallet debited, escrow created
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk());

        // Verify learner balance was debited (200 - 100 = 100)
        BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
        assertThat(learnerBalance).isEqualByComparingTo("100.00");

        // Verify escrowed payment exists
        Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
        assertThat(payment).isNotNull();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.ESCROWED);
        assertThat(payment.getAmount()).isEqualByComparingTo("100.00");

        // Start the booking
        mockMvc.perform(post("/api/v1/bookings/{id}/start", bookingId)
                        .with(csrf())
                        .with(user(mentor)))
                .andExpect(status().isOk());

        // Complete the booking via status update → escrow released, mentor credited (90.00 after 10% fee)
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk());

        // Verify mentor received payout minus 10% fee
        BigDecimal mentorBalance = walletService.balance(reloadUser(mentor.getId())).balance();
        assertThat(mentorBalance).isEqualByComparingTo("90.00");

        // Verify payment released
        payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.RELEASED);
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 2: Insufficient wallet balance on acceptance
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenLearnerWithInsufficientBalance_whenBookingAccepted_thenReturn400() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("50.00"));

        Long bookingId = createBooking(futureSession.getId(), learner);

        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value(org.hamcrest.Matchers.containsString("Insufficient")));

        // Verify learner balance unchanged
        BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
        assertThat(learnerBalance).isEqualByComparingTo("50.00");
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 2b: Accept works for gateway payers with an empty wallet
    //  Escrow was already held at the gateway — the wallet is never the
    //  funding source, so acceptance must not require a wallet balance
    //  (this was the root cause of the mentor's failing Accept flow).
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenLearnerWithGatewayEscrow_whenBookingAccepted_thenOkWithoutWallet() throws Exception {
        // Learner never funded their wallet — they paid via the gateway.
        Long bookingId = createBooking(futureSession.getId(), learner);

        // Attach an already-escrowed gateway payment to the booking
        Booking booking = bookingRepository.findById(bookingId).orElseThrow();
        Payment payment = Payment.builder()
                .orderId("ORDER_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase())
                .learnerId(learner.getId())
                .mentorId(mentor.getId())
                .sessionId(futureSession.getId())
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .gateway("razorpay")
                .status(PaymentStatus.ESCROWED)
                .createdAt(OffsetDateTime.now())
                .build();
        payment = paymentRepository.save(payment);
        booking.setPayment(payment);
        bookingRepository.save(booking);

        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingStatus").value("ACCEPTED"));

        // Wallet untouched (still 0), gateway payment stays escrowed
        BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
        assertThat(learnerBalance).isEqualByComparingTo("0");
        Payment after = bookingRepository.findById(bookingId).orElseThrow().getPayment();
        assertThat(after.getStatus()).isEqualTo(PaymentStatus.ESCROWED);
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 3: Cancel pending booking (no wallet impact)
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenPendingBooking_whenCancelledByLearner_thenNoWalletChange() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        Long bookingId = createBooking(futureSession.getId(), learner);

        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk());

        // Verify learner balance unchanged (no escrow was created for pending booking)
        BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
        assertThat(learnerBalance).isEqualByComparingTo("200.00");

        // Verify no payment record exists
        Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
        assertThat(payment).isNull();
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 4: Cancel accepted booking (full refund)
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenAcceptedBooking_whenCancelled_thenFullRefund() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        Long bookingId = createBooking(futureSession.getId(), learner);

        // Mentor accepts → escrow held
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk());

        // Learner cancels → full refund
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(learner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk());

        // Verify learner fully refunded (200 - 100 + 100 = 200)
        BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
        assertThat(learnerBalance).isEqualByComparingTo("200.00");

        // Verify payment refunded
        Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
        assertThat(payment).isNotNull();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 5: Assigned learner can start their own booking
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenAcceptedBooking_whenAssignedLearnerStarts_thenReturnOk() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        // pastSession has an already-elapsed start time so starting is allowed
        Long bookingId = createBooking(pastSession.getId(), learner);

        // Mentor accepts → escrow held
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk());

        // Assigned learner starts the booking → allowed
        mockMvc.perform(post("/api/v1/bookings/{id}/start", bookingId)
                        .with(csrf())
                        .with(user(learner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingStatus").value("IN_PROGRESS"));
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 6: Non-participant can't start someone else's booking
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenAcceptedBooking_whenUnrelatedLearnerStarts_thenReturn400() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        // pastSession has an already-elapsed start time so the only reason for
        // rejection is the authorization check (not the time gate).
        Long bookingId = createBooking(pastSession.getId(), learner);

        // Mentor accepts → booking is ACCEPTED (eligible to start)
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk());

        // Unrelated learner (learner2) tries to start → rejected, booking unchanged
        mockMvc.perform(post("/api/v1/bookings/{id}/start", bookingId)
                        .with(csrf())
                        .with(user(learner2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value(org.hamcrest.Matchers.containsString(
                                "Only the session mentor, assigned learner, or an admin can start a booking")));

        Booking booking = bookingRepository.findById(bookingId).orElseThrow();
        assertThat(booking.getBookingStatus()).isEqualTo(BookingStatus.ACCEPTED);
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 7: Non-owner can't update booking status
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenNonOwnerLearner_whenCancelling_thenReturn400() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        Long bookingId = createBooking(futureSession.getId(), learner);

        // learner2 (different learner) tries to cancel learner1's booking → 400
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(learner2))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error")
                        .value(org.hamcrest.Matchers.containsString("Only the learner or mentor can cancel")));
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 8a: Learner booking list serializes payments (regression)
    //  With open-in-view=false, a LAZY payment proxy used to blow up the
    //  learner's Booked Sessions API (GET /api/v1/bookings) with a
    //  LazyInitializationException once a booking had a payment attached
    //  (i.e. after confirmation/escrow). The fix makes Booking.payment
    //  EAGER so the list always serializes.
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenAcceptedBookingWithEscrow_whenLearnerListsBookings_thenPaymentSerializes() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        Long bookingId = createBooking(futureSession.getId(), learner);

        // Mentor accepts → escrow held → booking.payment is populated
        mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                        .with(csrf())
                        .with(user(mentor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk());

        // The learner's Booked Sessions API must return 200 and include the
        // booking with its payment — not a 500 from an uninitialized proxy.
        mockMvc.perform(get("/api/v1/bookings")
                        .with(csrf())
                        .with(user(learner)))
                .andExpect(status().isOk())
                // Paginated response: the first booking lives in data.content.
                .andExpect(jsonPath("$.data.content[0].id").value(bookingId))
                .andExpect(jsonPath("$.data.content[0].bookingStatus").value("ACCEPTED"))
                .andExpect(jsonPath("$.data.content[0].payment.status").value("ESCROWED"))
                .andExpect(jsonPath("$.data.content[0].session.id").isNumber())
                .andExpect(jsonPath("$.data.content[0].session.mentor.id").value(mentor.getId()));
    }

    // ═══════════════════════════════════════════════════════════
    //  Test 8: Idempotency key replay returns same booking
    // ═══════════════════════════════════════════════════════════

    @Test
    void givenDuplicateIdempotencyKey_whenCreatingBooking_thenReturnSameBooking() throws Exception {
        creditWallet(learner.getId(), new BigDecimal("200.00"));

        String idempotencyKey = "test-key-12345678";

        // First request
        MvcResult firstResult = mockMvc.perform(post("/api/v1/bookings")
                        .with(csrf())
                        .with(user(learner))
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\": %d}".formatted(futureSession.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long firstBookingId = readBookingId(firstResult);

        // Second request with same key → returns same booking
        MvcResult secondResult = mockMvc.perform(post("/api/v1/bookings")
                        .with(csrf())
                        .with(user(learner))
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\": %d}".formatted(futureSession.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long secondBookingId = readBookingId(secondResult);
        assertThat(secondBookingId).isEqualTo(firstBookingId);
    }

    // ═══════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════

    private User createUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "") + UUID.randomUUID().toString().substring(0, 4));
        user.setFullName(role.name() + " User " + UUID.randomUUID().toString().substring(0, 8));
        user.setEnabled(true);
        if (role == UserRole.MENTOR) {
            // Marketplace gates require an admin-APPROVED verification status.
            user.setVerificationStatus(MentorVerificationStatus.APPROVED);
            user.setProfileCompleted(true);
        }
        return userRepository.save(user);
    }

    private SkillSession createSession(User sessionMentor, BigDecimal price,
                                        OffsetDateTime start, OffsetDateTime end) {
        SkillSession session = new SkillSession();
        session.setMentor(sessionMentor);
        session.setTitle("Integration Session " + UUID.randomUUID().toString().substring(0, 8));
        session.setDescription("Session description");
        session.setSessionType(SessionType.PUBLIC);
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
                "Test credit for integration test",
                "TEST",
                userId));
    }

    private Long createBooking(Long sessionId, User learnerUser) throws Exception {
        String idempotencyKey = "itest-" + UUID.randomUUID().toString().substring(0, 8);

        MvcResult result = mockMvc.perform(post("/api/v1/bookings")
                        .with(csrf())
                        .with(user(learnerUser))
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\": %d}".formatted(sessionId)))
                .andReturn();

        int responseStatus = result.getResponse().getStatus();
        if (responseStatus != 200) {
            String body = result.getResponse().getContentAsString();
            Exception resolved = result.getResolvedException();
            String errorDetail = resolved != null
                    ? resolved.getClass().getName() + ": " + resolved.getMessage()
                    : "no exception";
            throw new AssertionError(
                    "Create booking failed with status %d. body=%s error=%s".formatted(
                            responseStatus, body, errorDetail));
        }

        return readBookingId(result);
    }

    private long readBookingId(MvcResult result) throws Exception {
        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return root.path("data").path("id").asLong();
    }

    private User reloadUser(Long userId) {
        return userRepository.findById(userId).orElseThrow();
    }

    private String uniqueEmail(String prefix) {
        return prefix + "+" + UUID.randomUUID() + "@example.com";
    }
}
