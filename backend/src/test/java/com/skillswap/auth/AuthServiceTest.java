package com.skillswap.auth;

import com.skillswap.common.ApiClientException;
import com.skillswap.common.AuditLogService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import io.jsonwebtoken.Claims;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Date;
import java.util.Optional;

import static com.skillswap.auth.AuthDtos.LoginRequest;
import static com.skillswap.auth.AuthDtos.SignupRequest;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the redesigned authentication rules:
 * <ul>
 *   <li>Duplicate emails → HTTP 409 with a friendly message</li>
 *   <li>Duplicate usernames are rejected case-insensitively (Nakul == nakul) → 409</li>
 *   <li>Login works with either an email or a username</li>
 *   <li>Generic, non-enumerating error messages ("No account found." / "Incorrect password.")</li>
 *   <li>Display case of the username is preserved while uniqueness is enforced
 *       against the normalized lowercase copy</li>
 * </ul>
 */
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

    @Mock
    private LoginAttemptRepository loginAttemptRepository;

    @Mock
    private AuthAttemptRecorder attemptRecorder;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @InjectMocks
    private AuthService authService;

    // ── Signup ────────────────────────────────────────────────────────────────

    @Test
    void signupRejectsDuplicateEmailWith409() {
        when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);

        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> authService.signup(signupRequest("taken@example.com", "nakul123"), null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("An account with this email already exists.", ex.getMessage());
    }

    @Test
    void signupRejectsDuplicateUsernameCaseInsensitivelyWith409() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.existsByUsernameLower("nakul")).thenReturn(true);

        // "Nakul" must collide with an existing "nakul" / "NAKUL" account.
        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> authService.signup(signupRequest("new@example.com", "Nakul"), null));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("This username is already taken. Please choose another username.", ex.getMessage());
    }

    @Test
    void signupRejectsInvalidUsernameFormat() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);

        // Too short, and contains a disallowed character.
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.signup(signupRequest("new@example.com", "ab@c"), null));

        assertTrue(ex.getMessage().contains("Username must be 4"));
    }

    @Test
    void signupRejectsReservedUsername() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.signup(signupRequest("new@example.com", "admin"), null));

        assertEquals("This username is reserved. Please choose another one.", ex.getMessage());
    }

    @Test
    void signupStoresDisplayCaseAndNormalizedLowercaseUsername() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.existsByUsernameLower("nakul")).thenReturn(false);
        when(passwordEncoder.encode("Password123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(any(User.class), any(String.class))).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(User.class), any(String.class))).thenReturn("refresh-token");
        when(jwtService.extractTokenId("refresh-token")).thenReturn("token-id-1");
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.extractAllClaims("refresh-token")).thenReturn(claims);

        authService.signup(signupRequest("new@example.com", "Nakul"), null);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        // Display value preserved exactly as typed (getDisplayUsername() is
        // the handle — getUsername() is the UserDetails email contract)…
        assertEquals("Nakul", saved.getDisplayUsername());
        // …while the normalized copy drives case-insensitive uniqueness.
        assertEquals("nakul", saved.getUsernameLower());
    }

    @Test
    void signupSuccessForValidUniqueUsername() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.existsByUsernameLower("nakul123")).thenReturn(false);
        when(passwordEncoder.encode("Password123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtService.generateToken(any(User.class), any(String.class))).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(User.class), any(String.class))).thenReturn("refresh-token");
        when(jwtService.extractTokenId("refresh-token")).thenReturn("token-id-1");
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.extractAllClaims("refresh-token")).thenReturn(claims);

        var response = authService.signup(signupRequest("new@example.com", "nakul123"), null);

        assertEquals("access-token", response.token());
        assertEquals("new@example.com", response.email());
        assertEquals("nakul123", response.username());
        assertEquals(UserRole.LEARNER.name(), response.role());
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Test
    void loginByUsernameUsesCaseInsensitiveLookup() {
        User user = user("nakul123");
        when(userRepository.findByUsernameLower("nakul123")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(authenticationManager.authenticate(any())).thenReturn(mock(org.springframework.security.core.Authentication.class));
        when(jwtService.generateToken(any(User.class), any(String.class))).thenReturn("new-access");
        when(jwtService.generateRefreshToken(any(User.class), any(String.class))).thenReturn("new-refresh");
        when(jwtService.extractTokenId("new-refresh")).thenReturn("token-id-2");
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.extractAllClaims("new-refresh")).thenReturn(claims);

        var response = authService.login(new LoginRequest("NAKUL123", "pw"), null);

        assertEquals("new-access", response.token());
        assertEquals("nakul123", response.username());
        // Username login must never hit the email lookup.
        verify(userRepository).findByUsernameLower("nakul123");
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void loginByEmailUsesEmailLookup() {
        User user = user("nakul123");
        user.setEmail("nakul@gmail.com");
        when(userRepository.findByEmail("nakul@gmail.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(authenticationManager.authenticate(any())).thenReturn(mock(org.springframework.security.core.Authentication.class));
        when(jwtService.generateToken(any(User.class), any(String.class))).thenReturn("new-access");
        when(jwtService.generateRefreshToken(any(User.class), any(String.class))).thenReturn("new-refresh");
        when(jwtService.extractTokenId("new-refresh")).thenReturn("token-id-2");
        Claims claims = mock(Claims.class);
        when(claims.getExpiration()).thenReturn(new Date(System.currentTimeMillis() + 600000));
        when(jwtService.extractAllClaims("new-refresh")).thenReturn(claims);

        var response = authService.login(new LoginRequest("NAKUL@GMAIL.COM", "pw"), null);

        assertEquals("new-access", response.token());
        verify(userRepository).findByEmail("nakul@gmail.com");
        verify(userRepository, never()).findByUsernameLower(any());
    }

    @Test
    void loginUnknownAccountReturnsGenericNoAccountFound() {
        when(userRepository.findByUsernameLower("ghost")).thenReturn(Optional.empty());

        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> authService.login(new LoginRequest("ghost", "pw"), null));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("No account found.", ex.getMessage());
    }

    @Test
    void loginWrongPasswordReturnsIncorrectPassword() {
        User user = user("nakul123");
        when(userRepository.findByEmail("nakul@gmail.com")).thenReturn(Optional.of(user));
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("bad password"));

        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> authService.login(new LoginRequest("nakul@gmail.com", "wrong"), null));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("Incorrect password.", ex.getMessage());
    }

    @Test
    void loginDisabledAccountReturnsClearMessage() {
        User user = user("nakul123");
        user.setEnabled(false);
        when(userRepository.findByEmail("nakul@gmail.com")).thenReturn(Optional.of(user));
        when(authenticationManager.authenticate(any()))
                .thenThrow(new DisabledException("disabled"));

        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> authService.login(new LoginRequest("nakul@gmail.com", "pw"), null));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("Your account has been disabled. Please contact support.", ex.getMessage());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static SignupRequest signupRequest(String email, String username) {
        return new SignupRequest(
                email,
                "Password123",
                "Nakul Sharma",
                username,
                UserRole.LEARNER,
                null);
    }

    private static User user(String username) {
        User user = new User();
        user.setId(1L);
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setRole(UserRole.LEARNER);
        return user;
    }
}
