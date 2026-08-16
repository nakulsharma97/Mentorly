package com.skillswap.session;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.notification.AppNotification;
import com.skillswap.notification.AppNotificationRepository;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.session.SessionController.CreateSessionRequest;
import com.skillswap.user.MentorVerificationStatus;
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

/**
 * Integration coverage for the Public / Private 1:1 session rules:
 * <ul>
 *   <li>ONE session instance = ONE learner (double-booking rejection).</li>
 *   <li>PUBLIC sessions are discoverable only while available.</li>
 *   <li>PRIVATE sessions are visible only to their target learner.</li>
 *   <li>Completed / cancelled sessions can never be booked again.</li>
 *   <li>Private-session creation notifies the target learner.</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:session-visibility-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class SessionVisibilityIntegrationTest {

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
    private AppNotificationRepository appNotificationRepository;

    private User mentor;
    private User learnerA;
    private User learnerB;

    @BeforeEach
    void setUp() {
        mentor = createApprovedMentor(uniqueEmail("mentor"));
        learnerA = createUser(uniqueEmail("learnerA"), UserRole.LEARNER);
        learnerB = createUser(uniqueEmail("learnerB"), UserRole.LEARNER);
    }

    // ── TEST CASE 1 + 5 — public session, one learner, double-booking lock ──

    @Test
    void publicSession_bookedByOneLearner_isGoneFromDiscoveryAndRejectsOthers() throws Exception {
        long sessionId = createSessionViaApi("Java OOP", "PUBLIC", null, "500");

        // Learner A sees it in public discovery.
        mockMvc.perform(get("/api/v1/sessions/public").with(user(learnerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + sessionId + ")]").exists());

        // Learner A books it successfully.
        mockMvc.perform(post("/api/v1/bookings")
                        .with(user(learnerA)).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + sessionId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").isNumber());

        // Once claimed, it disappears from public discovery entirely.
        mockMvc.perform(get("/api/v1/sessions/public").with(user(learnerB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + sessionId + ")]").doesNotExist());

        // It also disappears from the mentor's public profile listing.
        mockMvc.perform(get("/api/v1/sessions/mentor/" + mentor.getId()).with(user(learnerB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + sessionId + ")]").doesNotExist());

        // Learner B cannot book the same instance.
        mockMvc.perform(post("/api/v1/bookings")
                        .with(user(learnerB)).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + sessionId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value(org.hamcrest.Matchers.containsString("no longer available")));
    }

    // ── TEST CASE 2 — private session visibility + authorization ──

    @Test
    void privateSession_visibleAndBookableOnlyByTargetLearner() throws Exception {
        long sessionId = createSessionViaApi("Java OOP Revision", "PRIVATE",
                String.valueOf(learnerA.getId()), "500");

        // Target learner sees it in their "For You" list.
        mockMvc.perform(get("/api/v1/sessions/private").with(user(learnerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + sessionId + ")]").exists());

        // A different learner does NOT see it, and cannot fetch it by direct URL.
        mockMvc.perform(get("/api/v1/sessions/private").with(user(learnerB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + sessionId + ")]").doesNotExist());
        mockMvc.perform(get("/api/v1/sessions/" + sessionId).with(user(learnerB)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/sessions/mentor/" + mentor.getId()).with(user(learnerB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + sessionId + ")]").doesNotExist());

        // Non-target booking attempt is rejected by the backend.
        mockMvc.perform(post("/api/v1/bookings")
                        .with(user(learnerB)).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + sessionId + "}"))
                .andExpect(status().isBadRequest());

        // Target learner books it successfully.
        mockMvc.perform(post("/api/v1/bookings")
                        .with(user(learnerA)).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + sessionId + "}"))
                .andExpect(status().isOk());

        // The mentor's session list shows the booking snapshot for the private session.
        mockMvc.perform(get("/api/v1/sessions").with(user(mentor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + sessionId + ")].bookingState").exists());
    }

    // ── Private session creation notification ──

    @Test
    void privateSessionCreation_persistsNotificationForTargetLearner() throws Exception {
        long sessionId = createSessionViaApi("Java OOP Revision", "PRIVATE",
                String.valueOf(learnerA.getId()), "500");

        List<AppNotification> notifications = appNotificationRepository.findAll().stream()
                .filter(n -> n.getUser() != null && n.getUser().getId().equals(learnerA.getId()))
                .filter(n -> "PRIVATE_SESSION_CREATED".equals(n.getType()))
                .filter(n -> n.getReferenceId() != null && n.getReferenceId().equals(sessionId))
                .toList();

        assertThat(notifications).as("target learner must receive a real persisted notification")
                .isNotEmpty();
        assertThat(notifications.get(0).getTitle()).isEqualTo("New Private Session");
        assertThat(notifications.get(0).getMessage())
                .contains(mentor.getFullName())
                .contains("specifically for you");
    }

    // ── TEST CASE 3 — completed session can never be re-booked ──

    @Test
    void completedSession_cannotBeBookedByAnotherLearner() throws Exception {
        SkillSession past = createSession(mentor, "Past Java Session", SessionType.PUBLIC,
                null, new BigDecimal("0.00"),
                OffsetDateTime.now().minusDays(1), OffsetDateTime.now().minusDays(1).plusHours(1));

        // Learner A books, mentor accepts (free → no escrow), session completes.
        String bookingId = bookSession(learnerA, past.getId());
        mockMvc.perform(patch("/api/v1/bookings/" + bookingId + "/status")
                        .with(user(mentor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/bookings/" + bookingId + "/start").with(user(mentor)).with(csrf()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/bookings/" + bookingId + "/complete").with(user(mentor)).with(csrf()))
                .andExpect(status().isOk());

        // Learner B must not be able to book the completed instance.
        mockMvc.perform(post("/api/v1/bookings")
                        .with(user(learnerB)).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + past.getId() + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.error").value(org.hamcrest.Matchers.containsString("no longer available")));
    }

    // ── Mentor cancel: removes from discovery + notifies booked learner ──

    @Test
    void mentorCancelSession_cancelsBookingAndRemovesFromDiscovery() throws Exception {
        long sessionId = createSessionViaApi("Java OOP", "PUBLIC", null, "500");
        String bookingId = bookSession(learnerA, sessionId);

        mockMvc.perform(post("/api/v1/sessions/" + sessionId + "/cancel").with(user(mentor)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        // The learner's booking was cancelled through the standard lifecycle.
        mockMvc.perform(get("/api/v1/bookings").with(user(learnerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + bookingId + ")].bookingStatus").value("CANCELLED"));

        // The session no longer appears in public discovery.
        mockMvc.perform(get("/api/v1/sessions/public").with(user(learnerB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + sessionId + ")]").doesNotExist());
    }

    // ── TEST CASE 6 — free sessions are bookable and accepted without escrow ──

    @Test
    void freeSession_canBeBookedAndAccepted() throws Exception {
        long sessionId = createSessionViaApi("Free Java Basics", "PUBLIC", null, "0");

        String bookingId = bookSession(learnerA, sessionId);
        mockMvc.perform(patch("/api/v1/bookings/" + bookingId + "/status")
                        .with(user(mentor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACCEPTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingStatus").value("ACCEPTED"));
    }

    // ── helpers ──

    private long createSessionViaApi(String title, String sessionType, String targetLearnerId, String price) throws Exception {
        OffsetDateTime start = OffsetDateTime.now().plusDays(3);
        OffsetDateTime end = start.plusHours(1);
        String body = objectMapper.writeValueAsString(new CreateSessionRequest(
                title, "Description", sessionType, targetLearnerId == null ? null : Long.valueOf(targetLearnerId),
                start, end, new BigDecimal(price), null, 24, 12, 1, false));

        MvcResult result = mockMvc.perform(post("/api/v1/sessions")
                        .with(user(mentor)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andReturn();

        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.path("data").path("id").asLong();
    }

    private String bookSession(User learner, long sessionId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/bookings")
                        .with(user(learner)).with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + sessionId + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.path("data").path("id").asText();
    }

    private User createApprovedMentor(String email) {
        User mentor = createUser(email, UserRole.MENTOR);
        mentor.setMentorVerified(true);
        mentor.setVerificationStatus(MentorVerificationStatus.APPROVED);
        mentor.setProfileCompleted(true);
        return userRepository.save(mentor);
    }

    private User createUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(email.split("@")[0]);
        user.setFullName("User " + email.split("@")[0]);
        user.setRole(role);
        user.setEnabled(true);
        user.setProfileCompleted(true);
        // Non-null password column; the MockMvc `user(...)` principal bypasses login.
        user.setPasswordHash("$2a$10$testHash" + UUID.randomUUID().toString().replace("-", ""));
        return userRepository.save(user);
    }

    private SkillSession createSession(User mentor, String title, SessionType type,
                                       User targetLearner, BigDecimal price,
                                       OffsetDateTime start, OffsetDateTime end) {
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle(title);
        session.setDescription("desc");
        session.setSessionType(type);
        session.setTargetLearner(targetLearner);
        session.setStartTime(start);
        session.setEndTime(end);
        session.setPriceAmount(price);
        session.setMaxParticipants(1);
        session.setStatus(SessionStatus.PENDING);
        return sessionRepository.save(session);
    }

    private static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@test.com";
    }
}
