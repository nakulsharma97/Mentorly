package com.skillswap.booking;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.payment.PaymentStatus;
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
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.annotation.Rollback;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@org.springframework.test.context.TestPropertySource(properties = {
                "app.jwt.expiration-ms=3600000",
                "app.jwt.refresh-expiration-ms=604800000",
                "app.auth.cookies.secure=false",
                "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
                "app.polygon.rpc-url=http://localhost:8545",
                "spring.datasource.url=jdbc:h2:mem:booking-lifecycle-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
                "spring.datasource.driver-class-name=org.h2.Driver",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "spring.flyway.enabled=false"
})
class BookingLifecycleIntegrationTest {

        @MockBean
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

        @Test
        @Transactional
        @Rollback
        void givenLearnerWithSufficientBalance_whenBookingAccepted_thenWalletDebited() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(mentor, new BigDecimal("100.00"), OffsetDateTime.now().plusDays(2),
                                OffsetDateTime.now().plusDays(2).plusHours(1));

                creditWallet(learner.getId(), new BigDecimal("200.00"));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
                String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);

                Long bookingId = createBooking(session.getId(), learnerToken, "booking-lifecycle-test-1");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"ACCEPTED"}
                                                """))
                                .andExpect(status().isOk());

                BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
                assertThat(learnerBalance).isEqualByComparingTo("100.00");

                Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
                assertThat(payment).isNotNull();
                assertThat(payment.getStatus()).isEqualTo(PaymentStatus.ESCROWED);
                assertThat(payment.getAmount()).isEqualByComparingTo("100.00");
        }

        @Test
        @Transactional
        @Rollback
        void givenLearnerWithInsufficientBalance_whenBookingAccepted_thenReturn400() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(mentor, new BigDecimal("100.00"), OffsetDateTime.now().plusDays(2),
                                OffsetDateTime.now().plusDays(2).plusHours(1));

                creditWallet(learner.getId(), new BigDecimal("50.00"));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
                String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);

                Long bookingId = createBooking(session.getId(), learnerToken, "booking-lifecycle-test-2");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"ACCEPTED"}
                                                """))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.data.error")
                                                .value(org.hamcrest.Matchers.containsString("Insufficient")));

                BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
                assertThat(learnerBalance).isEqualByComparingTo("50.00");
        }

        @Test
        @Transactional
        @Rollback
        void givenAcceptedBooking_whenCompleted_thenMentorCreditedAndFeeDeducted() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(
                                mentor,
                                new BigDecimal("100.00"),
                                OffsetDateTime.now().minusHours(3),
                                OffsetDateTime.now().minusHours(1));

                creditWallet(learner.getId(), new BigDecimal("200.00"));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
                String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);

                Long bookingId = createBooking(session.getId(), learnerToken, "booking-lifecycle-test-3");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"ACCEPTED"}
                                                """))
                                .andExpect(status().isOk());

                mockMvc.perform(post("/api/v1/bookings/{id}/start", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken)))
                                .andExpect(status().isOk());

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"COMPLETED"}
                                                """))
                                .andExpect(status().isOk());

                BigDecimal mentorBalance = walletService.balance(reloadUser(mentor.getId())).balance();
                assertThat(mentorBalance).isEqualByComparingTo("90.00");

                Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
                assertThat(payment).isNotNull();
                assertThat(payment.getStatus()).isEqualTo(PaymentStatus.RELEASED);
        }

        @Test
        @Transactional
        @Rollback
        void givenPendingBooking_whenCancelledByLearner_thenNoWalletChange() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(mentor, new BigDecimal("100.00"), OffsetDateTime.now().plusDays(3),
                                OffsetDateTime.now().plusDays(3).plusHours(1));

                creditWallet(learner.getId(), new BigDecimal("200.00"));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
                Long bookingId = createBooking(session.getId(), learnerToken, "booking-lifecycle-test-4");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"CANCELLED"}
                                                """))
                                .andExpect(status().isOk());

                BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
                assertThat(learnerBalance).isEqualByComparingTo("200.00");

                Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
                assertThat(payment).isNull();
        }

        @Test
        @Transactional
        @Rollback
        void givenAcceptedBooking_whenCancelledBeforeWindow_thenFullRefund() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(
                                mentor,
                                new BigDecimal("100.00"),
                                OffsetDateTime.now().plusHours(48),
                                OffsetDateTime.now().plusHours(49));

                creditWallet(learner.getId(), new BigDecimal("200.00"));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
                String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);
                Long bookingId = createBooking(session.getId(), learnerToken, "booking-lifecycle-test-5");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"ACCEPTED"}
                                                """))
                                .andExpect(status().isOk());

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"CANCELLED"}
                                                """))
                                .andExpect(status().isOk());

                BigDecimal learnerBalance = walletService.balance(reloadUser(learner.getId())).balance();
                assertThat(learnerBalance).isEqualByComparingTo("200.00");

                Payment payment = bookingRepository.findById(bookingId).orElseThrow().getPayment();
                assertThat(payment).isNotNull();
                assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        }

        @Test
        @Transactional
        @Rollback
        void givenCompletedBooking_whenLearnerSubmitsReview_thenReviewSaved() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(
                                mentor,
                                new BigDecimal("100.00"),
                                OffsetDateTime.now().minusHours(4),
                                OffsetDateTime.now().minusHours(2));

                creditWallet(learner.getId(), new BigDecimal("200.00"));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);
                String mentorToken = loginAndGetJwtToken(mentor.getEmail(), defaultPassword);
                Long bookingId = createBooking(session.getId(), learnerToken, "booking-lifecycle-test-6");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"ACCEPTED"}
                                                """))
                                .andExpect(status().isOk());

                mockMvc.perform(post("/api/v1/bookings/{id}/start", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken)))
                                .andExpect(status().isOk());

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(mentorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"COMPLETED"}
                                                """))
                                .andExpect(status().isOk());

                mockMvc.perform(post("/api/v1/reviews")
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {
                                                  "bookingId": %d,
                                                  "mentorId": %d,
                                                  "rating": 5,
                                                  "comment": "Great session!"
                                                }
                                                """.formatted(bookingId, mentor.getId())))
                                .andExpect(status().is2xxSuccessful())
                                .andExpect(jsonPath("$.message").value("Review submitted"));

                mockMvc.perform(get("/api/v1/reviews/mentor/{mentorId}", mentor.getId())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.reviews[0].comment").value("Great session!"));
        }

        @Test
        @Transactional
        @Rollback
        void givenNonOwnerLearner_whenUpdatingBookingStatus_thenReturn400() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner1 = createUser(uniqueEmail("learner1"), UserRole.LEARNER);
                User learner2 = createUser(uniqueEmail("learner2"), UserRole.LEARNER);
                SkillSession session = createSession(mentor, new BigDecimal("100.00"), OffsetDateTime.now().plusDays(2),
                                OffsetDateTime.now().plusDays(2).plusHours(1));

                String learner1Token = loginAndGetJwtToken(learner1.getEmail(), defaultPassword);
                String learner2Token = loginAndGetJwtToken(learner2.getEmail(), defaultPassword);

                Long bookingId = createBooking(session.getId(), learner1Token, "booking-lifecycle-test-7");

                mockMvc.perform(patch("/api/v1/bookings/{id}/status", bookingId)
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learner2Token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"status":"CANCELLED"}
                                                """))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @Transactional
        @Rollback
        void givenDuplicateBookingRequest_whenSameIdempotencyKey_thenReturnSameBooking() throws Exception {
                User mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR);
                User learner = createUser(uniqueEmail("learner"), UserRole.LEARNER);
                SkillSession session = createSession(mentor, new BigDecimal("100.00"), OffsetDateTime.now().plusDays(2),
                                OffsetDateTime.now().plusDays(2).plusHours(1));

                String learnerToken = loginAndGetJwtToken(learner.getEmail(), defaultPassword);

                String idempotencyKey = "test-key-123";

                MvcResult firstResult = mockMvc.perform(post("/api/v1/bookings")
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                                .header("Idempotency-Key", idempotencyKey)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"sessionId": %d}
                                                """.formatted(session.getId())))
                                .andExpect(status().isOk())
                                .andReturn();

                long firstBookingId = readBookingId(firstResult);

                MvcResult secondResult = mockMvc.perform(post("/api/v1/bookings")
                                .with(csrf())
                                .header(HttpHeaders.AUTHORIZATION, bearer(learnerToken))
                                .header("Idempotency-Key", idempotencyKey)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"sessionId": %d}
                                                """.formatted(session.getId())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("Booking replayed"))
                                .andReturn();

                long secondBookingId = readBookingId(secondResult);
                assertThat(secondBookingId).isEqualTo(firstBookingId);
        }

        private User createUser(String email, UserRole role) {
                User user = new User();
                user.setEmail(email);
                user.setPasswordHash(passwordEncoder.encode(defaultPassword));
                user.setRole(role);
                user.setReferralCode("TEST-" + UUID.randomUUID());
                user.setFullName(role.name() + " User " + UUID.randomUUID());
                user.setEnabled(true);
                return userRepository.save(user);
        }

        private SkillSession createSession(User mentor, BigDecimal price, OffsetDateTime start, OffsetDateTime end) {
                SkillSession session = new SkillSession();
                session.setMentor(mentor);
                session.setTitle("Integration Session " + UUID.randomUUID());
                session.setDescription("Session description");
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
                                "Test credit",
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
                        Exception resolvedException = result.getResolvedException();
                        String body = result.getResponse().getContentAsString();
                        String message = "Create booking failed with status %d. response=%s resolved=%s".formatted(
                                        responseStatus,
                                        body,
                                        resolvedException == null ? "null"
                                                        : resolvedException.getClass().getName() + ": "
                                                                        + resolvedException.getMessage());
                        if (resolvedException != null) {
                                throw new AssertionError(message, resolvedException);
                        }
                        throw new AssertionError(message);
                }

                return readBookingId(result);
        }

        private long readBookingId(MvcResult result) throws Exception {
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
                                .orElseThrow(() -> new IllegalStateException(
                                                "Access token cookie not found after login"));
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
