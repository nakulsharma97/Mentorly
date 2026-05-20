package com.skillswap.auth;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static com.skillswap.auth.AuthDtos.*;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    @Lazy
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final MeterRegistry meterRegistry;

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            incrementCounter("auth.signup.failed", "reason", "duplicate_email");
            throw new IllegalArgumentException("Email already registered");
        }

        User user = new User();
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setFullName(req.fullName());
        user.setRole(req.role() == null ? UserRole.LEARNER : req.role());
        user.setWalletAddress(req.walletAddress());
        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.signup.success");
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.email(), req.password()));
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.login.success");
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse loginWithOAuth(String provider, Map<String, Object> attributes) {
        String email = extractOAuthEmail(provider, attributes);

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = new User();
            created.setEmail(email);
            created.setFullName(extractDisplayName(attributes, email));
            created.setRole(UserRole.LEARNER);
            created.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            created.setLastActiveAt(OffsetDateTime.now());
            return userRepository.save(created);
        });

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.oauth.success", "provider", provider.toLowerCase(Locale.ROOT));
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String refreshToken = request.refreshToken();
        if (refreshToken == null || refreshToken.isBlank()) {
            incrementCounter("auth.refresh.failed", "reason", "blank_token");
            throw new IllegalArgumentException("Refresh token is required");
        }
        if (!jwtService.isRefreshToken(refreshToken)) {
            incrementCounter("auth.refresh.failed", "reason", "invalid_token");
            throw new IllegalArgumentException("Invalid refresh token");
        }

        String email = jwtService.extractUsername(refreshToken);
        String tokenId = jwtService.extractTokenId(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token user"));
        RefreshTokenSession tokenSession = refreshTokenSessionRepository.findByTokenIdAndRevokedFalse(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token was revoked"));
        if (!tokenSession.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Refresh token does not belong to this user");
        }

        tokenSession.setRevoked(true);
        refreshTokenSessionRepository.save(tokenSession);

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String newAccessToken = jwtService.generateToken(user);
        String rotatedRefreshToken = jwtService.generateRefreshToken(user);
        persistRefreshSession(user, rotatedRefreshToken);
        incrementCounter("auth.refresh.success");
        return new AuthResponse(newAccessToken, rotatedRefreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public LogoutAllResponse logoutAllSessions(User user) {
        int revokedSessions = refreshTokenSessionRepository.revokeAllByUserAndRevokedFalse(user);
        incrementCounter("auth.logout_all.success");
        return new LogoutAllResponse(revokedSessions);
    }

    private void persistRefreshSession(User user, String refreshToken) {
        RefreshTokenSession tokenSession = new RefreshTokenSession();
        tokenSession.setUser(user);
        tokenSession.setTokenId(jwtService.extractTokenId(refreshToken));
        tokenSession.setExpiresAt(jwtService.extractAllClaims(refreshToken).getExpiration().toInstant()
                .atOffset(java.time.ZoneOffset.UTC));
        refreshTokenSessionRepository.save(tokenSession);
    }

    private void incrementCounter(String name, String... tags) {
        try {
            meterRegistry.counter(name, tags).increment();
        } catch (RuntimeException ignored) {
            // No-op in tests where metrics are mocked.
        }
    }

    private String extractOAuthEmail(String provider, Map<String, Object> attributes) {
        String email = toCleanString(attributes.get("email"));
        if (email != null) {
            return email;
        }

        // GitHub can return private emails; fallback keeps account creation
        // deterministic.
        if ("github".equalsIgnoreCase(provider)) {
            String login = toCleanString(attributes.get("login"));
            if (login != null) {
                return login.toLowerCase(Locale.ROOT) + "@users.noreply.github.com";
            }
        }

        throw new IllegalArgumentException("Unable to read email from OAuth provider");
    }

    private String extractDisplayName(Map<String, Object> attributes, String email) {
        String name = toCleanString(attributes.get("name"));
        if (name != null) {
            return name;
        }

        String login = toCleanString(attributes.get("login"));
        if (login != null) {
            return login;
        }

        int atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(0, atIndex) : email;
    }

    private String toCleanString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
