package com.mentorly.auth;

import com.mentorly.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies refresh-token single-use rotation:
 * <ul>
 *   <li>A successfully refreshed token is revoked, so replaying it is rejected.</li>
 *   <li>Concurrent refresh requests with the same token serialize on the DB row
 *       (pessimistic write lock) and exactly one rotation succeeds.</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:refresh-rotation-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545"
})
class RefreshTokenRotationIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @Autowired
    private AuthService authService;

    private AuthDtos.AuthResponse signUpLearner() {
        String unique = UUID.randomUUID().toString().replace("-", "");
        return authService.signup(new AuthDtos.SignupRequest(
                "rot-" + unique.substring(0, 8) + "@example.com",
                "Password123!",
                "Rotation User",
                "rot" + unique.substring(0, 8),
                UserRole.LEARNER,
                null), "127.0.0.1");
    }

    @Test
    void refreshToken_isRotatedAndReplayIsRejected() {
        AuthDtos.AuthResponse auth = signUpLearner();
        String originalRefreshToken = auth.refreshToken();
        assertThat(originalRefreshToken).isNotBlank();

        // First refresh succeeds and rotates to a NEW token.
        AuthDtos.AuthResponse rotated = authService.refreshToken(originalRefreshToken);
        assertThat(rotated.refreshToken()).isNotBlank();
        assertThat(rotated.refreshToken()).isNotEqualTo(originalRefreshToken);

        // Replaying the already-used token must be rejected.
        assertThatThrownBy(() -> authService.refreshToken(originalRefreshToken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("revoked or expired");

        // Reuse detection revokes the ENTIRE session family — the rotated token
        // (same family) must now also be rejected.
        assertThatThrownBy(() -> authService.refreshToken(rotated.refreshToken()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("revoked or expired");
    }

    @Test
    void concurrentRefreshRequestsWithSameToken_allowExactlyOneSuccess() throws Exception {
        AuthDtos.AuthResponse auth = signUpLearner();
        String refreshToken = auth.refreshToken();
        assertThat(refreshToken).isNotBlank();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch startGate = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger(0);
        AtomicReference<Throwable> unexpected = new AtomicReference<>();
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < 2; i++) {
            futures.add(pool.submit(() -> {
                startGate.await();
                try {
                    authService.refreshToken(refreshToken);
                    successes.incrementAndGet();
                } catch (IllegalArgumentException | org.springframework.dao.PessimisticLockingFailureException expected) {
                    // The losing refresh request must be rejected — only one
                    // rotation may win the row lock. Rejection surfaces either as
                    // the revoked-token error, or on some databases as a lock
                    // acquisition failure — both are valid losing outcomes.
                } catch (Throwable ex) {
                    unexpected.set(ex);
                }
                return null;
            }));
        }

        startGate.countDown();
        for (Future<?> future : futures) {
            future.get(15, TimeUnit.SECONDS);
        }
        pool.shutdownNow();

        assertThat(unexpected.get()).isNull();
        assertThat(successes.get()).isEqualTo(1);
    }
}
