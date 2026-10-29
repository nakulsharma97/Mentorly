package com.mentorly.notification;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises {@link BrevoApiEmailTransport} against a fake Brevo endpoint built on
 * the JDK's {@link HttpServer} — no new dependency and no network access.
 */
class BrevoApiEmailTransportTest {

    private static final String API_KEY = "xkeysib-test-key-123";
    private static final String OTP = "482913";
    private static final Duration REQUEST_TIMEOUT = Duration.ofMillis(600);

    private final ObjectMapper objectMapper = new ObjectMapper();

    private HttpServer server;
    private String baseUrl;

    private volatile String capturedPath;
    private volatile String capturedApiKey;
    private volatile String capturedContentType;
    private volatile String capturedAccept;
    private volatile String capturedBody;
    private volatile int responseStatus = 201;
    private volatile String responseBody = "{\"messageId\":\"<20261029@brevo>\"}";
    private volatile long handlerDelayMs;

    @BeforeEach
    void startFakeBrevo() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v3/smtp/email", exchange -> {
            capturedPath = exchange.getRequestURI().getPath();
            capturedApiKey = exchange.getRequestHeaders().getFirst("api-key");
            capturedContentType = exchange.getRequestHeaders().getFirst("content-type");
            capturedAccept = exchange.getRequestHeaders().getFirst("accept");
            capturedBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);

            if (handlerDelayMs > 0) {
                try {
                    Thread.sleep(handlerDelayMs);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }
            try {
                byte[] payload = responseBody.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("content-type", "application/json");
                exchange.sendResponseHeaders(responseStatus, payload.length);
                exchange.getResponseBody().write(payload);
            } catch (IOException ignored) {
                // The client may have timed out and closed the connection.
            } finally {
                exchange.close();
            }
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopFakeBrevo() {
        if (server != null) {
            server.stop(0);
        }
    }

    private BrevoApiEmailTransport transport() {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
        return new BrevoApiEmailTransport(API_KEY, "no-reply@mentorly.app", "Mentorly", baseUrl,
                client, objectMapper, REQUEST_TIMEOUT);
    }

    @Test
    void postsTheBrevoContractWithApiKeyHeader() throws Exception {
        transport().send("learner@example.com", "Verify your Mentorly account", "Your code is " + OTP);

        assertEquals("/v3/smtp/email", capturedPath);
        assertEquals(API_KEY, capturedApiKey);
        assertTrue(capturedContentType != null && capturedContentType.startsWith("application/json"),
                "content-type must be application/json, was " + capturedContentType);
        assertTrue(capturedAccept != null && capturedAccept.startsWith("application/json"),
                "accept must be application/json, was " + capturedAccept);

        JsonNode payload = objectMapper.readTree(capturedBody);
        assertEquals("Mentorly", payload.at("/sender/name").asText());
        assertEquals("no-reply@mentorly.app", payload.at("/sender/email").asText());
        assertEquals("learner@example.com", payload.at("/to/0/email").asText());
        assertEquals("Verify your Mentorly account", payload.get("subject").asText());
        assertEquals("Your code is " + OTP, payload.get("textContent").asText());
    }

    @Test
    void treats201AsSuccess() {
        responseStatus = 201;
        assertDoesNotThrow(() -> transport().send("learner@example.com", "Subject", "Body"));
    }

    @Test
    void postsToABaseUrlWithTrailingSlash() {
        baseUrl = baseUrl + "/";
        transport().send("learner@example.com", "Subject", "Body");
        assertEquals("/v3/smtp/email", capturedPath);
    }

    @ParameterizedTest
    @ValueSource(ints = { 400, 401, 403, 500 })
    void nonTwoHundredStatusesFailWithTheGenericMessage(int status) {
        responseStatus = status;
        responseBody = "{\"code\":\"unauthorized\",\"message\":\"Key not found\"}";

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> transport().send("learner@example.com", "Subject", "Your code is " + OTP));

        assertEquals("Unable to send email. Please try again.", ex.getMessage());
    }

    @Test
    void logsStatusAndProviderMessageButNeverTheKeyOrTheCode() {
        responseStatus = 401;
        responseBody = "{\"code\":\"unauthorized\",\"message\":\"Key not found\"}";

        Logger logger = (Logger) LoggerFactory.getLogger(BrevoApiEmailTransport.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertThrows(RuntimeException.class,
                    () -> transport().send("learner@example.com", "Subject", "Your code is " + OTP));
        } finally {
            logger.detachAppender(appender);
        }

        List<String> logs = appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
        String joined = String.join("\n", logs);
        assertTrue(joined.contains("status=401"), "expected the HTTP status in the log, got: " + joined);
        assertTrue(joined.contains("Key not found"), "expected Brevo's message in the log, got: " + joined);
        assertFalse(joined.contains(API_KEY), "the API key must never be logged, got: " + joined);
        assertFalse(joined.contains(OTP), "the email body must never be logged, got: " + joined);
    }

    @Test
    void timesOutInsteadOfHangingWhenTheProviderStalls() {
        handlerDelayMs = 3_000;

        long startedAt = System.nanoTime();
        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> transport().send("learner@example.com", "Subject", "Body"));
        long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();

        assertEquals("Unable to send email. Please try again.", ex.getMessage());
        assertTrue(elapsedMs < 2_000, "transport should give up at its request timeout, took " + elapsedMs + "ms");
    }

    @Test
    void connectionFailureFailsWithTheGenericMessage() {
        BrevoApiEmailTransport unreachable = new BrevoApiEmailTransport(API_KEY,
                "no-reply@mentorly.app", "Mentorly", "http://127.0.0.1:1",
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(500)).build(),
                objectMapper, REQUEST_TIMEOUT);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> unreachable.send("learner@example.com", "Subject", "Body"));
        assertEquals("Unable to send email. Please try again.", ex.getMessage());
    }
}
