package com.skillswap.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.auth.cookies.secure=false",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545",
        "spring.datasource.url=jdbc:h2:mem:booking-ws-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false"
})
class BookingChatWebSocketHandlerTest {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.skillswap.auth.JwtService jwtService;

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private NotificationService notificationService;

    private User learner;
    private User mentor;
    private Booking booking;
    private String learnerToken;
    private String mentorToken;
    private final List<WebSocket> openSockets = new ArrayList<>();

    @BeforeEach
    void setUp() {
        mentor = createUser("mentor", UserRole.MENTOR);
        learner = createUser("learner", UserRole.LEARNER);

        SkillSession session = createSession(mentor);
        booking = createBooking(session, learner);

        learnerToken = jwtService.generateToken(learner);
        mentorToken = jwtService.generateToken(mentor);
    }

    @AfterEach
    void cleanUp() throws Exception {
        for (WebSocket ws : openSockets) {
            try {
                ws.sendClose(1000, "cleanup").get(3, TimeUnit.SECONDS);
            } catch (Exception ignored) {
            }
        }
        openSockets.clear();
        chatMessageRepository.deleteAll();
        bookingRepository.deleteAll();
        sessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ────────────── Helpers ──────────────

    private User createUser(String prefix, UserRole role) {
        User user = new User();
        user.setEmail(prefix + "+" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setReferralCode("REF-" + UUID.randomUUID());
        user.setFullName(role.name() + " " + prefix);
        user.setEnabled(true);
        return userRepository.save(user);
    }

    private SkillSession createSession(User mentorUser) {
        SkillSession session = new SkillSession();
        session.setMentor(mentorUser);
        session.setTitle("Test Session " + UUID.randomUUID());
        session.setDescription("Session description");
        session.setSessionType("ONLINE");
        session.setStartTime(OffsetDateTime.now().plusDays(1));
        session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
        session.setPriceAmount(new BigDecimal("50.00"));
        session.setMeetingLink("https://example.com/meeting/" + UUID.randomUUID());
        session.setMaxParticipants(1);
        return sessionRepository.save(session);
    }

    private Booking createBooking(SkillSession session, User learnerUser) {
        Booking bk = new Booking();
        bk.setSession(session);
        bk.setLearner(learnerUser);
        bk.setBookingStatus(com.skillswap.booking.BookingStatus.PENDING);
        return bookingRepository.save(bk);
    }

    /**
     * Connect to the BookingChat WebSocket endpoint at /ws/chat.
     */
    private ConnectedWs connectWs(String accessToken, Long bookingId) throws Exception {
        String wsUrl = "ws://localhost:" + port + "/ws/chat?bookingId=" + bookingId;
        CountDownLatch openLatch = new CountDownLatch(1);
        CopyOnWriteArrayList<String> received = new CopyOnWriteArrayList<>();

        var builder = HttpClient.newHttpClient().newWebSocketBuilder();
        if (accessToken != null) {
            builder.header(HttpHeaders.COOKIE, AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + accessToken);
        }

        CompletableFuture<WebSocket> wsFuture = builder.buildAsync(URI.create(wsUrl), new WebSocket.Listener() {
            @Override
            public void onOpen(WebSocket webSocket) {
                openLatch.countDown();
                WebSocket.Listener.super.onOpen(webSocket);
            }

            @Override
            public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
                received.add(data.toString());
                return WebSocket.Listener.super.onText(webSocket, data, last);
            }
        });

        WebSocket ws = wsFuture.get(5, TimeUnit.SECONDS);
        openSockets.add(ws);
        assertThat(openLatch.await(5, TimeUnit.SECONDS))
                .as("WebSocket should open within timeout").isTrue();
        return new ConnectedWs(ws, received);
    }

    private record ConnectedWs(WebSocket ws, CopyOnWriteArrayList<String> received) {}

    private JsonNode parseSafely(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    /** Poll received messages for one with the given type, up to timeoutSeconds. */
    private JsonNode waitForType(CopyOnWriteArrayList<String> received, String type, long timeoutSeconds) throws Exception {
        long deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(timeoutSeconds);
        while (System.currentTimeMillis() < deadline) {
            for (String msg : received) {
                JsonNode node = parseSafely(msg);
                if (node != null && type.equals(node.path("type").asText())) {
                    return node;
                }
            }
            Thread.sleep(50);
        }
        return null;
    }

    /**
     * Poll a condition until it returns true or the timeout is reached.
     * Returns true if the condition was met, false on timeout.
     */
    private boolean waitForCondition(java.util.function.Supplier<Boolean> condition, long timeoutSeconds) throws Exception {
        long deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(timeoutSeconds);
        while (System.currentTimeMillis() < deadline) {
            if (Boolean.TRUE.equals(condition.get())) {
                return true;
            }
            Thread.sleep(50);
        }
        return false;
    }

    // ────────────── Tests ──────────────

    @Test
    void learnerCanSendTextMessageAndVerifyPersistence() throws Exception {
        ConnectedWs ws = connectWs(learnerToken, booking.getId());

        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "content", "Hello mentor!"
        )), true).join();

        // Sender should receive the broadcast back
        JsonNode broadcast = waitForType(ws.received(), "TEXT", 5);
        assertThat(broadcast).as("Sender should receive TEXT broadcast").isNotNull();
        assertThat(broadcast.path("message").path("content").asText()).isEqualTo("Hello mentor!");
        assertThat(broadcast.path("message").path("senderId").asLong()).isEqualTo(learner.getId());
        assertThat(broadcast.path("message").path("senderName").asText()).isEqualTo(learner.getFullName());
        assertThat(broadcast.path("message").path("bookingId").asLong()).isEqualTo(booking.getId());

        // Wait for @Transactional commit by polling the database
        assertThat(waitForCondition(() ->
                chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()).size() == 1, 5))
                .as("Message should be persisted").isTrue();
        assertThat(chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .allMatch(m -> m.getContent().equals("Hello mentor!"));
    }

    @Test
    void mentorCanSendTextMessage() throws Exception {
        ConnectedWs ws = connectWs(mentorToken, booking.getId());

        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "content", "Hi learner! Ready for our session?"
        )), true).join();

        JsonNode broadcast = waitForType(ws.received(), "TEXT", 5);
        assertThat(broadcast).as("Mentor should receive TEXT broadcast").isNotNull();
        assertThat(broadcast.path("message").path("content").asText()).isEqualTo("Hi learner! Ready for our session?");
        assertThat(broadcast.path("message").path("senderId").asLong()).isEqualTo(mentor.getId());

        assertThat(waitForCondition(() ->
                chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()).size() == 1, 5))
                .as("Message should be persisted").isTrue();
    }

    @Test
    void multipleMessagesArePersistedInOrder() throws Exception {
        ConnectedWs ws = connectWs(learnerToken, booking.getId());

        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT", "content", "First message"
        )), true).join();

        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT", "content", "Second message"
        )), true).join();

        // Wait for @Transactional commit by polling the database
        assertThat(waitForCondition(() ->
                chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()).size() == 2, 5))
                .as("Both messages should be persisted").isTrue();

        List<ChatMessage> saved = chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId());
        assertThat(saved.get(0).getContent()).isEqualTo("First message");
        assertThat(saved.get(1).getContent()).isEqualTo("Second message");
    }

    @Test
    void readMessageMarksBookingMessagesAsRead() throws Exception {
        // Pre-save messages from the mentor
        ChatMessage msg1 = new ChatMessage();
        msg1.setBooking(booking);
        msg1.setSender(mentor);
        msg1.setContent("Hello!");
        msg1.setReadByRecipient(false);
        chatMessageRepository.save(msg1);

        ChatMessage msg2 = new ChatMessage();
        msg2.setBooking(booking);
        msg2.setSender(mentor);
        msg2.setContent("Are you there?");
        msg2.setReadByRecipient(false);
        chatMessageRepository.save(msg2);

        // Learner connects and sends READ
        ConnectedWs ws = connectWs(learnerToken, booking.getId());

        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "READ",
                "bookingId", booking.getId()
        )), true).join();

        // Poll until the DB shows both messages as read
        assertThat(waitForCondition(() -> {
            ChatMessage m1 = chatMessageRepository.findById(msg1.getId()).orElse(null);
            ChatMessage m2 = chatMessageRepository.findById(msg2.getId()).orElse(null);
            return m1 != null && m2 != null && m1.isReadByRecipient() && m2.isReadByRecipient();
        }, 5)).as("Both messages should be marked as read").isTrue();
    }

    @Test
    void typedMessagesAreNotPersisted() throws Exception {
        ConnectedWs ws = connectWs(learnerToken, booking.getId());

        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TYPING",
                "bookingId", booking.getId()
        )), true).join();

        // TYPING should NOT persist to DB. Poll briefly to confirm no messages appear.
        Thread.sleep(100); // Brief wait to allow any async write that shouldn't happen
        assertThat(chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()))
                .isEmpty();

        // Connection should still be healthy — send a TEXT after TYPING
        ws.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "content", "Still connected?"
        )), true).join();

        JsonNode broadcast = waitForType(ws.received(), "TEXT", 5);
        assertThat(broadcast).as("Connection should remain open after TYPING").isNotNull();
    }

    @Test
    void connectionRejectedWhenBookingIdMissing() throws Exception {
        String wsUrl = "ws://localhost:" + port + "/ws/chat";
        CountDownLatch closeLatch = new CountDownLatch(1);
        int[] closeCode = {0};

        WebSocket ws = HttpClient.newHttpClient().newWebSocketBuilder()
                .header(HttpHeaders.COOKIE, AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + learnerToken)
                .buildAsync(URI.create(wsUrl), new WebSocket.Listener() {
                    @Override
                    public CompletionStage<?> onClose(WebSocket w, int code, String reason) {
                        closeCode[0] = code;
                        closeLatch.countDown();
                        return WebSocket.Listener.super.onClose(w, code, reason);
                    }

                    @Override
                    public void onError(WebSocket w, Throwable error) {
                        closeLatch.countDown();
                    }
                })
                .get(5, TimeUnit.SECONDS);

        openSockets.add(ws);
        assertThat(closeLatch.await(5, TimeUnit.SECONDS))
                .as("Connection should close when bookingId is missing").isTrue();
        assertThat(closeCode[0]).isIn(1002, 1003, 1007, 1008);
    }

    @Test
    void connectionRejectedWhenNotParticipant() throws Exception {
        // A third user who is neither the learner nor the mentor
        User outsider = createUser("outsider", UserRole.LEARNER);
        String outsiderToken = jwtService.generateToken(outsider);
        CountDownLatch closeLatch = new CountDownLatch(1);
        int[] closeCode = {0};

        WebSocket ws = HttpClient.newHttpClient().newWebSocketBuilder()
                .header(HttpHeaders.COOKIE, AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + outsiderToken)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/chat?bookingId=" + booking.getId()),
                        new WebSocket.Listener() {
                            @Override
                            public CompletionStage<?> onClose(WebSocket w, int code, String reason) {
                                closeCode[0] = code;
                                closeLatch.countDown();
                                return WebSocket.Listener.super.onClose(w, code, reason);
                            }

                            @Override
                            public void onError(WebSocket w, Throwable error) {
                                closeLatch.countDown();
                            }
                        })
                .get(5, TimeUnit.SECONDS);

        openSockets.add(ws);
        assertThat(closeLatch.await(5, TimeUnit.SECONDS))
                .as("Non-participant should be rejected").isTrue();
        assertThat(closeCode[0]).isIn(1003, 1007, 1008);
    }

    @Test
    void connectionRejectedWithoutAuthToken() throws Exception {
        String wsUrl = "ws://localhost:" + port + "/ws/chat?bookingId=" + booking.getId();
        CountDownLatch closeLatch = new CountDownLatch(1);
        int[] closeCode = {0};

        WebSocket ws = HttpClient.newHttpClient().newWebSocketBuilder()
                .buildAsync(URI.create(wsUrl), new WebSocket.Listener() {
                    @Override
                    public CompletionStage<?> onClose(WebSocket w, int code, String reason) {
                        closeCode[0] = code;
                        closeLatch.countDown();
                        return WebSocket.Listener.super.onClose(w, code, reason);
                    }

                    @Override
                    public void onError(WebSocket w, Throwable error) {
                        closeLatch.countDown();
                    }
                })
                .get(5, TimeUnit.SECONDS);

        openSockets.add(ws);
        assertThat(closeLatch.await(5, TimeUnit.SECONDS))
                .as("Connection without token should be rejected").isTrue();
        assertThat(closeCode[0]).isEqualTo(1003);
    }
}
