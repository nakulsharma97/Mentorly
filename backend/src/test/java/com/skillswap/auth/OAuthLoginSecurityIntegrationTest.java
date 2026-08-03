package com.skillswap.auth;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Security integration tests for the OAuth login flow:
 *
 * <ul>
 *   <li>Per-IP rate limiting — 10 OAuth callbacks allowed per 15-min window,
 *       the 11th is rejected (prevents mass account creation via OAuth).</li>
 *   <li>Disabled (banned) accounts cannot sign in through OAuth.</li>
 *   <li>Malformed / missing provider attributes are rejected.</li>
 * </ul>
 * Each test uses a dedicated IP so counters never leak between tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:oauth-login-security-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class OAuthLoginSecurityIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ── 1. Rate limiting: 10 OAuth callbacks per IP allowed, 11th blocked ──

    @Test
    void oauthLogin_allowsTenCallbacksPerIpThenBlocksTheEleventh() {
        String ip = "10.2.0.21";

        for (int i = 0; i < 10; i++) {
            Map<String, Object> attrs = Map.of(
                    "email", "oauth-" + i + "-" + UUID.randomUUID() + "@example.com",
                    "name", "OAuth User " + i);
            authService.loginWithOAuth("google", attrs, ip);
        }

        assertThatThrownBy(() -> authService.loginWithOAuth("google",
                Map.of("email", "blocked-" + UUID.randomUUID() + "@example.com", "name", "Blocked"), ip))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Too many sign-in attempts");
    }

    @Test
    void oauthLogin_differentIpsHaveIndependentCounters() {
        for (int i = 0; i < 10; i++) {
            authService.loginWithOAuth("google",
                    Map.of("email", "ip-a-" + i + "-" + UUID.randomUUID() + "@example.com", "name", "A"), "10.2.0.31");
        }
        // A new IP is unaffected by the counter on the other IP.
        authService.loginWithOAuth("google",
                Map.of("email", "fresh-" + UUID.randomUUID() + "@example.com", "name", "Fresh"), "10.2.0.32");
    }

    // ── 2. Disabled account check ──

    @Test
    void oauthLogin_disabledAccountIsRejected() {
        String email = "disabled-" + UUID.randomUUID() + "@example.com";
        createUser(email, UserRole.LEARNER, false);

        assertThatThrownBy(() -> authService.loginWithOAuth("google",
                Map.of("email", email, "name", "Disabled User"), "10.2.0.41"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("account has been disabled");
    }

    @Test
    void oauthLogin_enabledAccountSucceeds() {
        String email = "enabled-" + UUID.randomUUID() + "@example.com";
        createUser(email, UserRole.LEARNER, true);

        AuthDtos.AuthResponse response = authService.loginWithOAuth("google",
                Map.of("email", email, "name", "Enabled User"), "10.2.0.42");

        org.assertj.core.api.Assertions.assertThat(response.token()).isNotBlank();
        org.assertj.core.api.Assertions.assertThat(response.refreshToken()).isNotBlank();
    }

    // ── 3. Validation ──

    @Test
    void oauthLogin_malformedEmailIsRejected() {
        assertThatThrownBy(() -> authService.loginWithOAuth("google",
                Map.of("email", "not-an-email", "name", "Bad Email"), "10.2.0.51"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("valid email");
    }

    @Test
    void oauthLogin_nullAttributesAreRejected() {
        assertThatThrownBy(() -> authService.loginWithOAuth("google", null, "10.2.0.52"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("attributes");
    }

    @Test
    void oauthLogin_blankProviderIsRejected() {
        assertThatThrownBy(() -> authService.loginWithOAuth("  ",
                Map.of("email", "any-" + UUID.randomUUID() + "@example.com", "name", "X"), "10.2.0.53"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("provider");
    }

    private User createUser(String email, UserRole role, boolean enabled) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "")
                + UUID.randomUUID().toString().substring(0, 4));
        user.setReferralCode("OAUTH-" + UUID.randomUUID());
        user.setFullName("OAuth Test " + UUID.randomUUID().toString().substring(0, 6));
        user.setEnabled(enabled);
        return userRepository.save(user);
    }
}
