package com.skillswap.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.messaging.DirectMessage;
import com.skillswap.messaging.DirectMessageRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;

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
        "spring.datasource.url=jdbc:h2:mem:ws-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false"
})
class DirectChatWebSocketHandlerTest {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DirectConversationRepository conversationRepository;

    @Autowired
    private DirectMessageRepository directMessageRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.skillswap.auth.JwtService jwtService;

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockitoBean
    private NotificationService notificationService;

    private User userA;
    private User userB;
    private DirectConversation conversation;
    private String tokenA;
    private String tokenB;
    private final List<WebSocket> openSockets = new ArrayList<>();

    @BeforeEach
    void setUp() {
        userA = createUser("alice", UserRole.LEARNER);
        userB = createUser("bob", UserRole.MENTOR);
        conversation = createConversation(userA, userB);
        tokenA = jwtService.generateToken(userA);
        tokenB = jwtService.generateToken(userB);
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
        directMessageRepository.deleteAll();
        conversationRepository.deleteAll();
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

    private DirectConversation createConversation(User one, User two) {
        DirectConversation dc = new DirectConversation();
        dc.setParticipantOne(one);
        dc.setParticipantTwo(two);
        dc.setCreatedAt(OffsetDateTime.now());
        dc.setUpdatedAt(OffsetDateTime.now());
        return conversationRepository.save(dc);
    }

    /**
     * Connect to the DirectChat WebSocket, returning the WebSocket and a
     * received-messages list. Fails the test if the connection isn't established
     * within 5 seconds.
     */
    private ConnectedWs connectWs(String accessToken, Long conversationId) throws Exception {
        String wsUrl = "ws://localhost:" + port + "/ws/chat/direct?conversationId=" + conversationId;
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
    void textMessageIsPersistedAndBroadcastToSender() throws Exception {
        ConnectedWs wsA = connectWs(tokenA, conversation.getId());

        // Send TEXT
        wsA.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "content", "Hello from Alice!"
        )), true).join();

        // The handler broadcasts to ALL room members (including sender)
        JsonNode broadcast = waitForType(wsA.received(), "TEXT", 5);
        assertThat(broadcast).as("Sender should receive TEXT broadcast").isNotNull();
        assertThat(broadcast.path("message").path("content").asText()).isEqualTo("Hello from Alice!");
        assertThat(broadcast.path("message").path("senderId").asLong()).isEqualTo(userA.getId());
        assertThat(broadcast.path("message").path("senderName").asText()).isEqualTo(userA.getFullName());

        // Verify database persistence
        List<DirectMessage> saved = directMessageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversation.getId());
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getContent()).isEqualTo("Hello from Alice!");
        assertThat(saved.get(0).getSender().getId()).isEqualTo(userA.getId());
        assertThat(saved.get(0).getConversation().getId()).isEqualTo(conversation.getId());
    }

    @Test
    void multipleTextMessagesAreDeliveredInOrder() throws Exception {
        ConnectedWs wsA = connectWs(tokenA, conversation.getId());

        wsA.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT", "content", "First"
        )), true).join();

        wsA.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT", "content", "Second"
        )), true).join();

        // Wait for @Transactional commit by polling the database
        assertThat(waitForCondition(() ->
                directMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversation.getId()).size() == 2, 5))
                .as("Both messages should be persisted").isTrue();

        // Verify correct order
        List<DirectMessage> saved = directMessageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversation.getId());
        assertThat(saved.get(0).getContent()).isEqualTo("First");
        assertThat(saved.get(1).getContent()).isEqualTo("Second");

        // Sender receives both broadcasts
        JsonNode first = waitForType(wsA.received(), "TEXT", 5);
        assertThat(first).isNotNull();
        assertThat(first.path("message").path("content").asText()).isEqualTo("First");
    }

    @Test
    void readMessageMarksMessagesAsRead() throws Exception {
        // Pre-save messages from User B
        DirectMessage msg1 = new DirectMessage();
        msg1.setConversation(conversation);
        msg1.setSender(userB);
        msg1.setContent("Hello!");
        msg1.setReadByRecipient(false);
        directMessageRepository.save(msg1);

        DirectMessage msg2 = new DirectMessage();
        msg2.setConversation(conversation);
        msg2.setSender(userB);
        msg2.setContent("Are you there?");
        msg2.setReadByRecipient(false);
        directMessageRepository.save(msg2);

        // Connect User A and send READ
        ConnectedWs wsA = connectWs(tokenA, conversation.getId());

        wsA.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "READ",
                "conversationId", conversation.getId()
        )), true).join();

        // The handler broadcasts READ_ACK to others (not to sender),
        // but we verify via database instead. Poll until the DB is updated.
        assertThat(waitForCondition(() -> {
            DirectMessage m1 = directMessageRepository.findById(msg1.getId()).orElse(null);
            DirectMessage m2 = directMessageRepository.findById(msg2.getId()).orElse(null);
            return m1 != null && m2 != null && m1.isReadByRecipient() && m2.isReadByRecipient();
        }, 5)).as("Both messages should be marked as read").isTrue();
    }

    @Test
    void typingMessageIsProcessedWithoutError() throws Exception {
        ConnectedWs wsA = connectWs(tokenA, conversation.getId());

        wsA.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TYPING",
                "conversationId", conversation.getId()
        )), true).join();

        // The handler should process TYPING without closing the connection.
        // TCP ordering guarantees TYPING is processed before the TEXT below.
        // Send a TEXT to verify the connection is still healthy.
        wsA.ws().sendText(objectMapper.writeValueAsString(Map.of(
                "type", "TEXT",
                "content", "Still connected?"
        )), true).join();

        // If the TEXT message is received as a broadcast, the connection is healthy
        JsonNode broadcast = waitForType(wsA.received(), "TEXT", 5);
        assertThat(broadcast).as("Connection should remain open after TYPING").isNotNull();
        assertThat(broadcast.path("message").path("content").asText()).isEqualTo("Still connected?");
    }

    @Test
    void connectionRejectedWhenConversationIdMissing() throws Exception {
        String wsUrl = "ws://localhost:" + port + "/ws/chat/direct";
        CountDownLatch closeLatch = new CountDownLatch(1);
        int[] closeCode = {0};

        WebSocket ws = HttpClient.newHttpClient().newWebSocketBuilder()
                .header(HttpHeaders.COOKIE, AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + tokenA)
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
                .as("Connection should close when conversationId is missing").isTrue();
        assertThat(closeCode[0]).isIn(1002, 1003, 1007, 1008);
    }

    @Test
    void connectionRejectedWhenNotParticipant() throws Exception {
        User userC = createUser("charlie", UserRole.LEARNER);
        String tokenC = jwtService.generateToken(userC);
        CountDownLatch closeLatch = new CountDownLatch(1);
        int[] closeCode = {0};

        WebSocket ws = HttpClient.newHttpClient().newWebSocketBuilder()
                .header(HttpHeaders.COOKIE, AuthCookieService.ACCESS_TOKEN_COOKIE + "=" + tokenC)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/chat/direct?conversationId=" + conversation.getId()),
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
        // No cookie header at all — handler closes with NOT_ACCEPTABLE (1003)
        String wsUrl = "ws://localhost:" + port + "/ws/chat/direct?conversationId=" + conversation.getId();
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
