package com.skillswap.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;

import com.skillswap.common.ApiClientException;
import static com.skillswap.auth.AuthDtos.ForgotPasswordRequest;
import static com.skillswap.auth.AuthDtos.LoginRequest;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the per-flow authentication rate limiting against a real database:
 * <ul>
 *   <li>Login and forgot-password each keep their OWN counter per IP — one
 *       flow can never exhaust the other's quota or lockout.</li>
 *   <li>The threshold is exact: 5 attempts per 15-minute window are allowed,
 *       the 6th is rejected (no off-by-one).</li>
 * </ul>
 * Each test uses a dedicated IP so counters never leak between tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:auth-rate-limit-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545",
        "app.security.trusted-proxy=false"
})
class AuthRateLimitIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private AuthService authService;

    private static final String WRONG_PASSWORD = "definitely-wrong-password";

    @Test
    void login_allowsFiveFailedAttemptsThenBlocksTheSixth() {
        String ip = "10.1.0.11";
        LoginRequest req = new LoginRequest("nobody-login@example.com", WRONG_PASSWORD);

        // Wrong credentials now surface as a generic 401 ApiClientException
        // (anti-enumeration) — the rate-limit counters are what this test checks.
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> authService.login(req, ip))
                    .isInstanceOf(ApiClientException.class)
                    .hasMessageContaining("No account found");
        }

        // 6th attempt: the LOGIN counter has reached the threshold → rejected.
        assertThatThrownBy(() -> authService.login(req, ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Too many login attempts");
    }

    @Test
    void forgotPassword_allowsFiveRequestsThenBlocksTheSixth() {
        String ip = "10.1.0.12";

        for (int i = 0; i < 5; i++) {
            authService.forgotPassword(new ForgotPasswordRequest("missing-" + i + "@example.com"), ip);
        }

        // 6th request: the FORGOT_PASSWORD counter has reached the threshold.
        assertThatThrownBy(() -> authService.forgotPassword(
                new ForgotPasswordRequest("missing@example.com"), ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Too many password reset requests");
    }

    @Test
    void loginFailures_doNotExhaustForgotPasswordQuota() {
        String ip = "10.1.0.13";

        for (int i = 0; i < 5; i++) {
            String email = "nobody-" + i + "@example.com";
            assertThatThrownBy(() -> authService.login(
                    new LoginRequest(email, WRONG_PASSWORD), ip))
                    .isInstanceOf(ApiClientException.class);
        }

        // The LOGIN counter is now at its threshold…
        assertThatThrownBy(() -> authService.login(
                new LoginRequest("nobody-login@example.com", WRONG_PASSWORD), ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Too many login attempts");

        // …but the FORGOT_PASSWORD counter is untouched, so the request succeeds.
        authService.forgotPassword(new ForgotPasswordRequest("missing@example.com"), ip);
    }

    @Test
    void login_persistentLockoutArmsAfterTenAttempts() {
        String ip = "10.1.0.15";
        LoginRequest req = new LoginRequest("nobody-lockout@example.com", WRONG_PASSWORD);

        // 5 failed attempts are allowed and recorded (counter 1..5).
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> authService.login(req, ip))
                    .isInstanceOf(ApiClientException.class)
                    .hasMessageContaining("No account found");
        }

        // Blocked attempts are still recorded, pushing the cumulative counter
        // upward (6..10) — this is what drives the exponential backoff ladder.
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> authService.login(req, ip))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Too many login attempts");
        }

        // Counter reached 10 → the persistent lockout (blockedUntil) is armed,
        // so the next attempt is rejected with the countdown message.
        assertThatThrownBy(() -> authService.login(req, ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Try again in");
    }

    @Test
    void forgotPasswordRequests_doNotExhaustLoginQuota() {
        String ip = "10.1.0.14";

        for (int i = 0; i < 5; i++) {
            authService.forgotPassword(new ForgotPasswordRequest("missing-" + i + "@example.com"), ip);
        }

        // The FORGOT_PASSWORD counter is now at its threshold…
        assertThatThrownBy(() -> authService.forgotPassword(
                new ForgotPasswordRequest("missing@example.com"), ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Too many password reset requests");

        // …but a login from the same IP still uses its own counter and reaches
        // the credential check (rejected with the generic 401, not blocked).
        assertThatThrownBy(() -> authService.login(
                new LoginRequest("nobody-login@example.com", WRONG_PASSWORD), ip))
                .isInstanceOf(ApiClientException.class)
                .hasMessageContaining("No account found");
    }
}
