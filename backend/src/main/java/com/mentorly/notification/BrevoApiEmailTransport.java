package com.mentorly.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Brevo (ex-Sendinblue) transactional email transport over HTTPS.
 *
 * <p>Render free web services block outbound SMTP ports 25/465/587, so SMTP can
 * never connect there. Brevo's v3 REST API runs on HTTPS/443, which works.
 *
 * <p>Every request is bounded: 5s to connect and 10s overall, so a stalled
 * provider can never leave callers (and the signup button behind them) waiting.
 * Failures are logged with the HTTP status and Brevo's {@code message} field
 * only — never the API key, never the message body (which contains the OTP).
 */
@Slf4j
public class BrevoApiEmailTransport implements EmailTransport {

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private static final String API_PATH = "/v3/smtp/email";
    private static final int MAX_LOGGED_MESSAGE_LENGTH = 200;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Duration requestTimeout;
    private final String apiKey;
    private final String fromAddress;
    private final String fromName;
    private final URI endpoint;

    public BrevoApiEmailTransport(String apiKey, String fromAddress, String fromName, String baseUrl) {
        this(apiKey, fromAddress, fromName, baseUrl,
                HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build(),
                new ObjectMapper(),
                REQUEST_TIMEOUT);
    }

    /** Visible for tests: lets a fake endpoint inject its client and a short timeout. */
    BrevoApiEmailTransport(String apiKey, String fromAddress, String fromName, String baseUrl,
            HttpClient httpClient, ObjectMapper objectMapper, Duration requestTimeout) {
        this.apiKey = apiKey == null ? "" : apiKey;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.requestTimeout = requestTimeout;
        this.endpoint = URI.create(stripTrailingSlash(baseUrl) + API_PATH);
    }

    @Override
    public void send(String to, String subject, String body) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(requestBody(to, subject, body));
        } catch (JsonProcessingException ex) {
            log.warn("Unable to serialise the Brevo email payload for {}", to);
            throw new RuntimeException(GENERIC_FAILURE_MESSAGE);
        }

        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(requestTimeout)
                .header("api-key", apiKey)
                .header("content-type", "application/json")
                .header("accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("Brevo email request interrupted for {}", to);
            throw new RuntimeException(GENERIC_FAILURE_MESSAGE);
        } catch (IOException ex) {
            // Covers HttpTimeoutException, connect failures and DNS errors alike.
            log.warn("Brevo email request failed for {}: {}", to, ex.getClass().getSimpleName());
            throw new RuntimeException(GENERIC_FAILURE_MESSAGE);
        }

        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            log.warn("Brevo rejected the email for {}: status={}, message={}",
                    to, status, brevoErrorMessage(response.body()));
            throw new RuntimeException(GENERIC_FAILURE_MESSAGE);
        }
    }

    private Map<String, Object> requestBody(String to, String subject, String body) {
        Map<String, Object> sender = new LinkedHashMap<>();
        sender.put("name", fromName);
        sender.put("email", fromAddress);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sender", sender);
        payload.put("to", List.of(Map.of("email", to)));
        payload.put("subject", subject);
        payload.put("textContent", body);
        return payload;
    }

    /**
     * Extracts Brevo's human-readable {@code message} field for logging. The
     * response body never echoes the request, so it cannot contain the OTP, but
     * it is still truncated to keep log lines bounded.
     */
    private String brevoErrorMessage(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "no response body";
        }
        try {
            JsonNode node = objectMapper.readTree(responseBody).get("message");
            if (node == null || node.isNull()) {
                return "no message field";
            }
            String message = node.asText();
            return message.length() > MAX_LOGGED_MESSAGE_LENGTH
                    ? message.substring(0, MAX_LOGGED_MESSAGE_LENGTH)
                    : message;
        } catch (IOException ex) {
            return "unparseable response body";
        }
    }

    private static String stripTrailingSlash(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "";
        }
        String trimmed = baseUrl.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
