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
import java.time.ZoneOffset;
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
    private final AccessTokenDenylistRepository accessTokenDenylistRepository;
    private final MeterRegistry meterRegistry;

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        String normalizedEmail = req.email().toLowerCase(Locale.ROOT).trim();

        if (userRepository.existsByEmail(normalizedEmail)) {
            incrementCounter("auth.signup.failed", "reason", "duplicate_email");
            throw new IllegalArgumentException("Email already registered");
        }

        if (req.role() == UserRole.ADMIN) {
            incrementCounter("auth.signup.failed", "reason", "admin_signup_blocked");
            throw new IllegalArgumentException("Admin accounts cannot be created via signup. Contact the platform administrator.");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setFullName(req.fullName());
        user.setRole(req.role() == null ? UserRole.LEARNER : req.role());
        user.setWalletAddress(req.walletAddress());
        user.setReferralCode(generateUniqueReferralCode());
        String referralCode = normalizeReferralCode(req.referralCode());
        if (referralCode != null) {
            userRepository.findByReferralCodeIgnoreCase(referralCode)
                    .ifPresent(referrer -> user.setReferredByUserId(referrer.getId()));
        }
        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String tokenId = UUID.randomUUID().toString();
        String token = jwtService.generateToken(user, tokenId);
        String refreshToken = jwtService.generateRefreshToken(user, tokenId);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.signup.success");
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        String normalizedEmail = req.email().toLowerCase(Locale.ROOT).trim();
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, req.password()));
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String tokenId = UUID.randomUUID().toString();
        String token = jwtService.generateToken(user, tokenId);
        String refreshToken = jwtService.generateRefreshToken(user, tokenId);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.login.success");
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse loginWithOAuth(String provider, Map<String, Object> attributes) {
        String email = extractOAuthEmail(provider, attributes).toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = new User();
            created.setEmail(email);
            created.setFullName(extractDisplayName(attributes, email));
            created.setRole(UserRole.LEARNER);
            created.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            created.setReferralCode(generateUniqueReferralCode());
            created.setLastActiveAt(OffsetDateTime.now());
            return userRepository.save(created);
        });

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String tokenId = UUID.randomUUID().toString();
        String token = jwtService.generateToken(user, tokenId);
        String refreshToken = jwtService.generateRefreshToken(user, tokenId);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.oauth.success", "provider", provider.toLowerCase(Locale.ROOT));
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name());
    }

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        return refreshToken(request.refreshToken());
    }

    @Transactional
    public AuthResponse refreshToken(String refreshToken) {
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
        RefreshTokenSession tokenSession = refreshTokenSessionRepository
                .findByTokenIdAndRevokedFalseAndExpiresAtAfter(tokenId, OffsetDateTime.now(ZoneOffset.UTC))
                .orElseThrow(() -> new IllegalArgumentException("Refresh token was revoked or expired"));
        if (!tokenSession.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Refresh token does not belong to this user");
        }

        tokenSession.setRevoked(true);
        refreshTokenSessionRepository.save(tokenSession);

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String newTokenId = UUID.randomUUID().toString();
        String newAccessToken = jwtService.generateToken(user, newTokenId);
        String rotatedRefreshToken = jwtService.generateRefreshToken(user, newTokenId);
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

    @Transactional
    public LogoutResponse logoutCurrentSession(String accessTokenValue) {
        String accessToken = extractAccessToken(accessTokenValue);
        if (!jwtService.isAccessToken(accessToken)) {
            incrementCounter("auth.logout.failed", "reason", "invalid_access_token");
            throw new IllegalArgumentException("Invalid access token");
        }

        String jwtId = jwtService.extractJwtId(accessToken);
        accessTokenDenylistRepository.findByJti(jwtId).orElseGet(() -> {
            AccessTokenDenylist denylisted = new AccessTokenDenylist();
            denylisted.setJti(jwtId);
            denylisted.setExpiresAt(jwtService.extractAllClaims(accessToken).getExpiration().toInstant()
                    .atOffset(ZoneOffset.UTC));
            return accessTokenDenylistRepository.save(denylisted);
        });

        int revokedSessions = refreshTokenSessionRepository
                .revokeByTokenIdAndRevokedFalse(jwtService.extractTokenId(accessToken));
        incrementCounter("auth.logout.success");
        return new LogoutResponse(revokedSessions);
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

    private String generateUniqueReferralCode() {
        String referralCode;
        do {
            referralCode = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        } while (userRepository.existsByReferralCodeIgnoreCase(referralCode));
        return referralCode;
    }

    private String normalizeReferralCode(String referralCode) {
        if (referralCode == null) {
            return null;
        }

        String trimmed = referralCode.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String extractAccessToken(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            throw new IllegalArgumentException("Access token is required");
        }

        String trimmed = tokenValue.trim();
        if (trimmed.startsWith("Bearer ")) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
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
