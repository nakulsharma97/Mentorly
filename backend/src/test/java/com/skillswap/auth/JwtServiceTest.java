package com.skillswap.auth;

import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringJUnitConfig(JwtService.class)
@TestPropertySource(properties = {
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000"
})
class JwtServiceTest {

    @Autowired
    private JwtService jwtService;

    private User userWithRole(UserRole role) {
        User user = new User();
        user.setId(1L);
        user.setEmail("user@skillswap.com");
        user.setFullName("Test User");
        user.setRole(role);
        user.setUsername("testuser");
        return user;
    }

    @Test
    void accessToken_storesAdminRoleClaim() {
        String token = jwtService.generateToken(userWithRole(UserRole.ADMIN));

        assertThat(jwtService.extractRole(token)).isEqualTo("ADMIN");
        assertThat(jwtService.isAccessToken(token)).isTrue();
    }

    @Test
    void accessToken_storesMentorRoleClaim() {
        String token = jwtService.generateToken(userWithRole(UserRole.MENTOR));

        assertThat(jwtService.extractRole(token)).isEqualTo("MENTOR");
        assertThat(jwtService.isAccessToken(token)).isTrue();
    }

    @Test
    void accessToken_storesLearnerRoleClaim() {
        String token = jwtService.generateToken(userWithRole(UserRole.LEARNER));

        assertThat(jwtService.extractRole(token)).isEqualTo("LEARNER");
        assertThat(jwtService.isAccessToken(token)).isTrue();
    }

    @Test
    void refreshToken_storesRoleClaim() {
        String token = jwtService.generateRefreshToken(userWithRole(UserRole.ADMIN));

        assertThat(jwtService.extractRole(token)).isEqualTo("ADMIN");
        assertThat(jwtService.isRefreshToken(token)).isTrue();
    }

    @Test
    void extractRole_isNullSafe_whenClaimMissing() {
        // Tokens signed before the role claim was introduced must still parse
        // without throwing — extractRole returns null instead.
        String legacyToken = jwtService.generateToken(Map.of("tokenType", "access"), userWithRole(UserRole.ADMIN));

        assertThat(jwtService.extractRole(legacyToken)).isNull();
        assertThat(jwtService.extractUsername(legacyToken)).isEqualTo("user@skillswap.com");
    }

    // ── Startup hardening: weak / default signing keys must never be accepted ──

    @Test
    void validateSecret_rejectsPreviouslyCommittedDefaultKey() {
        // Base64 of "secure-dev-jwt-secret-for-local-development" — the old
        // fallback that used to ship in application.yml (now public/compromised).
        ReflectionTestUtils.setField(jwtService, "secret",
                "c2VjdXJlLWRldi1qd3Qtc2VjcmV0LWZvci1sb2NhbC1kZXZlbG9wbWVudA==");

        assertThatThrownBy(jwtService::validateSecret)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("known default");
    }

    @Test
    void validateSecret_rejectsDocumentedExampleKey() {
        // Base64 of "change-me-change-me-change-me-change-me" — documented as a
        // default in the README. Must never be usable as a signing key.
        ReflectionTestUtils.setField(jwtService, "secret",
                "Y2hhbmdlLW1lLWNoYW5nZS1tZS1jaGFuZ2UtbWUtY2hhbmdlLW1l");

        assertThatThrownBy(jwtService::validateSecret)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("known default");
    }

    @Test
    void validateSecret_acceptsStrongKey() {
        // A strong, unique key must still pass validation (regression guard for
        // normal operation).
        ReflectionTestUtils.setField(jwtService, "secret",
                "VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==");

        jwtService.validateSecret(); // must not throw
    }
}
