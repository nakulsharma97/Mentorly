package com.skillswap.auth;

import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

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
}
