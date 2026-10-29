package com.mentorly.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;

import com.mentorly.common.ApiClientException;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;

import java.time.Duration;
import java.time.OffsetDateTime;

import static com.mentorly.auth.AuthDtos.ForgotPasswordRequest;
import static com.mentorly.auth.AuthDtos.LoginRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the per-flow authentication rate limiting against a real database:
 * <ul>
 *   <li>Login and forgot-password each keep their OWN counter per IP — one
 *       flow can never exhaust the other's quota or lockout.</li>
 *   <li>The threshold is exact: 5 attempts per 15-minute window are allowed,
 *       the 6th is rejected (no off-by-one).</li>
 *   <li>A rejected request never refreshes the window — otherwise hammering
 *       Sign In would keep the lockout alive indefinitely.</li>
 *   <li>The window really expires: after 15 quiet minutes a wrong password is
 *       evaluated again and starts a fresh counter.</li>
 *   <li>A successful login clears the counter for that IP.</li>
 *   <li>The exponential backoff ladder (10 → 20 → 50 → 100) still arms when
 *       that many failures are recorded inside one window.</li>
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

    @Autowired
    private AuthAttemptRecorder attemptRecorder;

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final String WRONG_PASSWORD = "definitely-wrong-password";
    private static final String CORRECT_PASSWORD = "Str0ngPass!23";

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

    /**
     * The reported bug: every click on Sign In used to record "another" failed
     * attempt, refreshing {@code lastAttemptAt} so the 15-minute window never
     * elapsed. A rejected request must leave the counter untouched.
     */
    @Test
    void blockedLoginAttempt_doesNotExtendTheWindow() {
        String ip = "10.1.0.16";
        LoginRequest req = new LoginRequest("nobody-window@example.com", WRONG_PASSWORD);

        // Fourteen minutes into the window with the threshold already reached:
        // one more minute is left before the block lifts.
        OffsetDateTime lastAttemptAt = OffsetDateTime.now().minusMinutes(14);
        seedLoginCounter(ip, 5, lastAttemptAt, null);

        // Clicking repeatedly must not move the window forward.
        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> authService.login(req, ip))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Too many login attempts")
                    .hasMessageContaining("Try again in 1 minute.");
        }

        LoginAttempt after = loginAttemptRepository
                .findByIpAddressAndAttemptType(ip, AttemptType.LOGIN)
                .orElseThrow();
        assertThat(after.getAttemptCount()).isEqualTo(5);
        // Still anchored ~14 minutes ago — a recorded click would have set it
        // to "now".
        assertThat(after.getLastAttemptAt()).isBefore(OffsetDateTime.now().minusMinutes(13));
        assertThat(after.getBlockedUntil()).isNull();
    }

    /**
     * Once the window has elapsed the counter starts over, so the first wrong
     * password afterwards is evaluated instead of being treated as the sixth
     * failure.
     */
    @Test
    void login_worksAgainAfterTheWindowExpires() {
        String ip = "10.1.0.17";

        // A stale row from a previous window: threshold reached, but 16 minutes
        // of quiet since the last attempt.
        seedLoginCounter(ip, 5, OffsetDateTime.now().minusMinutes(16), null);

        // The request is no longer blocked — it reaches the credential check.
        assertThatThrownBy(() -> authService.login(
                new LoginRequest("nobody-expired@example.com", WRONG_PASSWORD), ip))
                .isInstanceOf(ApiClientException.class)
                .hasMessageContaining("No account found");

        // …and the counter restarted from zero (1 failure in the new window).
        LoginAttempt after = loginAttemptRepository
                .findByIpAddressAndAttemptType(ip, AttemptType.LOGIN)
                .orElseThrow();
        assertThat(after.getAttemptCount()).isEqualTo(1);
    }

    /** A correct password clears the IP's failure counter. */
    @Test
    void successfulLogin_resetsTheFailureCounter() {
        String ip = "10.1.0.18";
        String email = createUser("reset-counter@example.com", "resetcounter");

        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> authService.login(
                    new LoginRequest(email, WRONG_PASSWORD), ip))
                    .isInstanceOf(ApiClientException.class)
                    .hasMessageContaining("Incorrect password");
        }
        assertThat(currentLoginCount(ip)).isEqualTo(3);

        authService.login(new LoginRequest(email, CORRECT_PASSWORD), ip);

        // The row is gone, so the next wrong password starts at 1 rather than 4.
        assertThat(loginAttemptRepository
                .findByIpAddressAndAttemptType(ip, AttemptType.LOGIN))
                .isEmpty();
        assertThatThrownBy(() -> authService.login(
                new LoginRequest(email, WRONG_PASSWORD), ip))
                .isInstanceOf(ApiClientException.class);
        assertThat(currentLoginCount(ip)).isEqualTo(1);
    }

    /**
     * The exponential backoff ladder is unchanged: it arms purely from
     * RECORDED failures, so ten real failures inside one window escalate to a
     * timed lockout instead of the plain window message.
     */
    @Test
    void login_backoffLadderStillArmsFromRecordedFailures() {
        String ip = "10.1.0.19";

        // Nine failures already recorded inside the current window.
        seedLoginCounter(ip, 9, OffsetDateTime.now().minusMinutes(1), null);

        attemptRecorder.recordFailedLogin(ip, "ladder@example.com");

        LoginAttempt armed = loginAttemptRepository
                .findByIpAddressAndAttemptType(ip, AttemptType.LOGIN)
                .orElseThrow();
        assertThat(armed.getAttemptCount()).isEqualTo(10);
        assertThat(armed.getBlockedUntil()).isNotNull();
        assertThat(armed.getBlockedUntil())
                .isBefore(OffsetDateTime.now().plus(Duration.ofMinutes(5)).plusSeconds(1));

        // The persistent lockout wins over the window check and reports a wait.
        assertThatThrownBy(() -> authService.login(
                new LoginRequest("nobody-ladder@example.com", WRONG_PASSWORD), ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Too many failed attempts. Try again in");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void seedLoginCounter(String ip, int count, OffsetDateTime lastAttemptAt,
                                  OffsetDateTime blockedUntil) {
        LoginAttempt attempt = new LoginAttempt();
        attempt.setIpAddress(ip);
        attempt.setAttemptType(AttemptType.LOGIN);
        attempt.setAttemptCount(count);
        attempt.setLastAttemptAt(lastAttemptAt);
        attempt.setBlockedUntil(blockedUntil);
        attempt.setEmail("seeded@example.com");
        attempt.setExpiresAt(OffsetDateTime.now().plusHours(24));
        loginAttemptRepository.saveAndFlush(attempt);
    }

    private int currentLoginCount(String ip) {
        return loginAttemptRepository
                .findByIpAddressAndAttemptType(ip, AttemptType.LOGIN)
                .map(LoginAttempt::getAttemptCount)
                .orElse(0);
    }

    private String createUser(String email, String username) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setFullName("Rate Limit Test User");
        user.setPasswordHash(passwordEncoder.encode(CORRECT_PASSWORD));
        user.setRole(UserRole.LEARNER);
        user.setEmailVerified(true);
        return userRepository.saveAndFlush(user).getEmail();
    }
}
