package com.mentorly.meeting.google;

import com.mentorly.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

/**
 * Admin endpoints that connect Mentorly to a Google account so live sessions
 * can receive Google Meet links.
 *
 * <p>Every route lives under {@code /api/v1/admin/**}, which
 * {@code SecurityConfig} already restricts to the ADMIN role. The callback is a
 * browser redirect from Google, so it is authenticated by the admin's
 * {@code access_token} cookie ({@code SameSite=Lax} cookies are sent on
 * top-level GET navigations) rather than an Authorization header.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/google-calendar")
@RequiredArgsConstructor
public class GoogleCalendarAuthController {

    /** HTTP session attribute holding the one-time OAuth {@code state} value. */
    static final String STATE_SESSION_KEY = "google_calendar_oauth_state";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int STATE_BYTES = 32;

    private final GoogleCalendarProperties properties;
    private final GoogleOAuthTokenManager tokenManager;

    @Value("${app.frontend-base-url:http://localhost:5174}")
    private String frontendBaseUrl;

    /**
     * Starts the OAuth consent flow. Used as a plain browser navigation
     * ({@code window.location.assign}) so the auth cookie is sent and Google's
     * redirect returns to an authenticated callback.
     */
    @GetMapping("/connect")
    public ResponseEntity<Void> connect(HttpServletRequest request) {
        if (!properties.isConfigured()) {
            log.warn("Google Calendar connect requested but the integration is not configured");
            return redirectToFrontend("error");
        }

        String state = generateState();
        request.getSession(true).setAttribute(STATE_SESSION_KEY, state);

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(tokenManager.buildAuthorizationUrl(state)))
                .build();
    }

    /**
     * JSON variant for SPA clients that prefer to open the consent screen
     * themselves (e.g. in a new tab).
     */
    @GetMapping("/connect-url")
    public ApiResponse<Map<String, String>> connectUrl(HttpServletRequest request) {
        if (!properties.isConfigured()) {
            return new ApiResponse<>("Google Calendar is not configured", Map.of("url", ""));
        }

        String state = generateState();
        request.getSession(true).setAttribute(STATE_SESSION_KEY, state);

        return new ApiResponse<>("Google Calendar authorization URL",
                Map.of("url", tokenManager.buildAuthorizationUrl(state)));
    }

    /**
     * OAuth redirect target. Validates {@code state} against the value stored in
     * the admin's session before exchanging the code, then bounces the browser
     * back to the admin UI with a result flag.
     */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "state", required = false) String state,
            HttpServletRequest request) {

        HttpSession session = request.getSession(false);
        Object expectedState = session == null ? null : session.getAttribute(STATE_SESSION_KEY);
        if (session != null) {
            // One-time use: a replayed callback must fail even with a valid code.
            session.removeAttribute(STATE_SESSION_KEY);
        }

        if (!stateMatches(expectedState, state)) {
            log.warn("Google Calendar callback rejected: OAuth state mismatch");
            return redirectToFrontend("error");
        }

        if (code == null || code.isBlank()) {
            log.warn("Google Calendar callback rejected: authorization code missing");
            return redirectToFrontend("error");
        }

        boolean connected = tokenManager.authenticate(code);
        log.info("Google Calendar connection attempt finished. Connected: {}", connected);
        return redirectToFrontend(connected ? "connected" : "error");
    }

    /**
     * Reports whether the integration can create meetings.
     */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> status() {
        boolean configured = properties.isConfigured();
        boolean connected = configured && tokenManager.hasValidToken();
        return new ApiResponse<>("Google Calendar status fetched",
                Map.of("configured", configured, "connected", connected));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private ResponseEntity<Void> redirectToFrontend(String result) {
        String base = frontendBaseUrl == null || frontendBaseUrl.isBlank()
                ? "http://localhost:5174"
                : frontendBaseUrl.trim().replaceAll("/+$", "");
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(base + "/admin?calendar=" + result))
                .build();
    }

    private static String generateState() {
        byte[] bytes = new byte[STATE_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean stateMatches(Object expected, String actual) {
        if (!(expected instanceof String expectedState) || actual == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expectedState.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}
