package com.skillswap.auth;

import com.skillswap.auth.AuthDtos.LoginRequest;
import com.skillswap.auth.AuthDtos.RefreshTokenRequest;
import com.skillswap.auth.AuthDtos.SignupRequest;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Date;
import java.util.Optional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static com.skillswap.auth.AuthDtos.LoginRequest;
import static com.skillswap.auth.AuthDtos.RefreshTokenRequest;
import static com.skillswap.auth.AuthDtos.SignupRequest;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtService jwtService;

    @Mock
    private RefreshTokenSessionRepository refreshTokenSessionRepository;

    @Mock
    private AccessTokenDenylistRepository accessTokenDenylistRepository;

    @Mock
    private MeterRegistry meterRegistry;

    @InjectMocks
    private AuthService authService;

    @Test
    void signupDefaultsToLearnerAndReturnsAccessAndRefreshToken() {
        SignupRequest request = new SignupRequest(
                "learner@example.com",
                "secret",
                "Learner One",
                null,
                null,
                null);

        when(userRepository.existsByEmail("learner@example.com")).thenReturn(false);
        when(passwordEncoder.encode("secret")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(any(User.class), any(String.class))).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(User.class), any(String.class))).thenReturn("refresh-token");
        when(jwtService.extractTokenId("refresh-token")).thenReturn("token-id-1");
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.extractAllClaims("refresh-token")).thenReturn(claims);

        var response = authService.signup(request);

        assertEquals("access-token", response.token());
        assertEquals("refresh-token", response.refreshToken());
        assertEquals("learner@example.com", response.email());
        assertEquals("LEARNER", response.role());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertEquals(UserRole.LEARNER, userCaptor.getValue().getRole());
    }

    @Test
    void loginReturnsTokensForExistingUser() {
        User user = new User();
        user.setEmail("mentor@example.com");
        user.setRole(UserRole.MENTOR);

        when(userRepository.findByEmail("mentor@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(any(User.class), any(String.class))).thenReturn("new-access");
        when(jwtService.generateRefreshToken(any(User.class), any(String.class))).thenReturn("new-refresh");
        when(jwtService.extractTokenId("new-refresh")).thenReturn("token-id-2");
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.extractAllClaims("new-refresh")).thenReturn(claims);

        var response = authService.login(new LoginRequest("mentor@example.com", "pw"));

        assertEquals("new-access", response.token());
        assertEquals("new-refresh", response.refreshToken());
        assertEquals("MENTOR", response.role());
        verify(authenticationManager).authenticate(any());
    }

    @Test
    void refreshTokenRejectsBlankToken() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.refreshToken(new RefreshTokenRequest(" ")));
        assertEquals("Refresh token is required", ex.getMessage());
    }

    @Test
    void refreshTokenRejectsNonRefreshToken() {
        when(jwtService.isRefreshToken("bad-token")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("bad-token")));
        assertEquals("Invalid refresh token", ex.getMessage());
    }

    @Test
    void refreshTokenRejectsMalformedToken() {
        when(jwtService.isRefreshToken("malformed")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("malformed")));
        assertEquals("Invalid refresh token", ex.getMessage());
    }

    @Test
    void refreshTokenRejectsRevokedSession() {
        User user = new User();
        user.setId(42L);
        user.setEmail("user@example.com");

        when(jwtService.isRefreshToken("refresh-token")).thenReturn(true);
        when(jwtService.extractUsername("refresh-token")).thenReturn("user@example.com");
        when(jwtService.extractTokenId("refresh-token")).thenReturn("token-id-3");
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(refreshTokenSessionRepository.findByTokenIdAndRevokedFalseAndExpiresAtAfter(eq("token-id-3"),
                any(OffsetDateTime.class))).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.refreshToken(new RefreshTokenRequest("refresh-token")));
        assertEquals("Refresh token was revoked or expired", ex.getMessage());
    }

    @Test
    void logoutCurrentSessionBlacklistsAccessTokenAndRevokesMatchingRefreshSession() {
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.isAccessToken("access-token")).thenReturn(true);
        when(jwtService.extractJwtId("access-token")).thenReturn("jwt-id-1");
        when(jwtService.extractTokenId("access-token")).thenReturn("session-id-1");
        when(jwtService.extractAllClaims("access-token")).thenReturn(claims);
        when(accessTokenDenylistRepository.findByJti("jwt-id-1")).thenReturn(Optional.empty());
        when(refreshTokenSessionRepository.revokeByTokenIdAndRevokedFalse("session-id-1")).thenReturn(1);

        var response = authService.logoutCurrentSession("Bearer access-token");

        assertEquals(1, response.revokedSessions());
        verify(accessTokenDenylistRepository).save(any(AccessTokenDenylist.class));
        verify(refreshTokenSessionRepository).revokeByTokenIdAndRevokedFalse("session-id-1");
    }
}
