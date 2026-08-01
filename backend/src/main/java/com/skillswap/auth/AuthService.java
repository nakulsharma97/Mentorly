package com.skillswap.auth;

import com.skillswap.common.AuditLogService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.skillswap.auth.AuthDtos.*;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9_]{3,20}$");

    private static final Set<String> RESERVED_USERNAMES = Set.of(
            "admin", "support", "login", "register", "signup", "mentor", "learner",
            "settings", "profile", "api", "root", "system", "skillswap", "skillswapper",
            "moderator", "help", "info", "mail", "noreply", "test", "null", "undefined");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    @Lazy
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final AccessTokenDenylistRepository accessTokenDenylistRepository;
    private final MeterRegistry meterRegistry;
    private final LoginAttemptRepository loginAttemptRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public AuthResponse signup(SignupRequest req, String clientIp) {
        String normalizedEmail = req.email().toLowerCase(Locale.ROOT).trim();

        // Rate-limit signups per IP to prevent mass account creation
        if (clientIp != null && !clientIp.isBlank()) {
            OffsetDateTime windowStart = OffsetDateTime.now().minusMinutes(60);
            long recentSignups = loginAttemptRepository
                    .countByIpAddressAndLastAttemptAtAfter(clientIp, windowStart);
            if (recentSignups > 10) {
                log.warn("Signup rate limit: ip={}, signups={} in 60min", clientIp, recentSignups);
                incrementCounter("auth.signup.failed", "reason", "rate_limited");
                throw new IllegalArgumentException("Too many accounts created from this IP. Please try again later.");
            }
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
            incrementCounter("auth.signup.failed", "reason", "duplicate_email");
            throw new IllegalArgumentException("Email already registered");
        }

        if (req.role() == UserRole.ADMIN) {
            incrementCounter("auth.signup.failed", "reason", "admin_signup_blocked");
            throw new IllegalArgumentException("Admin accounts cannot be created via signup. Contact the platform administrator.");
        }

        // ── Username validation ──
        String normalizedUsername = req.username().toLowerCase(Locale.ROOT).trim();
        if (!USERNAME_PATTERN.matcher(normalizedUsername).matches()) {
            throw new IllegalArgumentException(
                    "Username must be 3\u201320 characters: lowercase letters, numbers, and underscores only.");
        }
        if (RESERVED_USERNAMES.contains(normalizedUsername)) {
            throw new IllegalArgumentException("This username is reserved. Please choose another one.");
        }
        if (userRepository.existsByUsername(normalizedUsername)) {
            incrementCounter("auth.signup.failed", "reason", "duplicate_username");
            throw new IllegalArgumentException("Username already exists. Please choose another one.");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setUsername(normalizedUsername);
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
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name(), user.getDisplayUsername());
    }

    @Transactional
    public AuthResponse login(LoginRequest req, String clientIp) {
        String loginId = req.email().toLowerCase(Locale.ROOT).trim();

        // Detect if loginId is an email or username
        boolean isEmail = loginId.contains("@");
        String normalizedEmail = isEmail ? loginId : null;
        String normalizedUsername = isEmail ? null : loginId;

        // Brute-force protection: check IP-based rate limit with exponential backoff
        if (clientIp != null && !clientIp.isBlank()) {
            OffsetDateTime windowStart = OffsetDateTime.now().minusMinutes(15);
            long recentAttempts = loginAttemptRepository
                    .countByIpAddressAndLastAttemptAtAfter(clientIp, windowStart);

            // Adaptive throttling: as failed attempts increase, tolerance decreases
            // 1-5 attempts: 5 allowed | 6-10: 4 allowed | 11-20: 3 allowed | 21+: 2 allowed
            int maxAllowed = 5 - (int) Math.floor(recentAttempts / 5.0);
            maxAllowed = Math.max(maxAllowed, 2);           // Never allow fewer than 2

            if (recentAttempts > maxAllowed) {
                log.warn("Brute-force block: ip={}, attempts={} in 15min", clientIp, recentAttempts);
                incrementCounter("auth.login.failed", "reason", "rate_limited");
                throw new IllegalArgumentException("Too many login attempts. Please try again later.");
            }

            var existingAttempt = loginAttemptRepository.findByIpAddress(clientIp);
            if (existingAttempt.isPresent() && existingAttempt.get().getBlockedUntil() != null
                    && OffsetDateTime.now().isBefore(existingAttempt.get().getBlockedUntil())) {
                long remainingSeconds = java.time.Duration.between(
                        OffsetDateTime.now(), existingAttempt.get().getBlockedUntil()).getSeconds();
                log.warn("IP blocked: ip={}, remainingSeconds={}", clientIp, remainingSeconds);
                incrementCounter("auth.login.failed", "reason", "ip_blocked");
                throw new IllegalArgumentException(
                        "Too many failed attempts. Try again in " + remainingSeconds + " seconds.");
            }
        }

        // Resolve the user by email or username
        User user = isEmail
                ? userRepository.findByEmail(normalizedEmail).orElse(null)
                : userRepository.findByUsername(normalizedUsername).orElse(null);

        if (user == null) {
            if (clientIp != null && !clientIp.isBlank()) {
                recordFailedAttempt(clientIp, isEmail ? normalizedEmail : normalizedUsername);
            }
            throw new IllegalArgumentException("Invalid credentials");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getEmail(), req.password()));
        } catch (Exception ex) {
            if (clientIp != null && !clientIp.isBlank()) {
                recordFailedAttempt(clientIp, user.getEmail());
            }
            throw ex;
        }

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String tokenId = UUID.randomUUID().toString();
        String token = jwtService.generateToken(user, tokenId);
        String refreshToken = jwtService.generateRefreshToken(user, tokenId);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.login.success");
        recordAuthEvent("LOGIN", user);
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name(), user.getDisplayUsername());
    }

    @Transactional
    public AuthResponse loginWithOAuth(String provider, Map<String, Object> attributes) {
        String email = extractOAuthEmail(provider, attributes).toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = new User();
            created.setEmail(email);
            created.setUsername(generateUsernameFromEmail(email));
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
        recordAuthEvent("LOGIN", user);
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name(), user.getDisplayUsername());
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
        return new AuthResponse(newAccessToken, rotatedRefreshToken, user.getEmail(), user.getRole().name(), user.getDisplayUsername());
    }

    @Transactional
    public LogoutAllResponse logoutAllSessions(User user) {
        int revokedSessions = refreshTokenSessionRepository.revokeAllByUserAndRevokedFalse(user);
        incrementCounter("auth.logout_all.success");
        recordAuthEvent("LOGOUT", user);
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
        recordLogoutFromToken(accessToken);
        return new LogoutResponse(revokedSessions);
    }

    /**
     * Persists a login/logout audit entry for the given user. IP is resolved
     * from the request context by {@code AuditLogService}. Failures are never
     * allowed to break the auth flow — the audit entry is best-effort.
     */
    private void recordAuthEvent(String action, User user) {
        try {
            auditLogService.log(action, "Auth", user.getId(), user.getEmail(), user.getId());
        } catch (RuntimeException ex) {
            log.warn("Failed to record {} audit entry for userId={}", action, user.getId(), ex);
        }
    }

    /**
     * Records a logout audit entry for the access token's subject. The userId
     * is read from the JWT claim (no DB round-trip required).
     */
    private void recordLogoutFromToken(String accessToken) {
        try {
            Long userId = null;
            Object userIdClaim = jwtService.extractAllClaims(accessToken).get("userId");
            if (userIdClaim != null) {
                userId = Long.valueOf(String.valueOf(userIdClaim));
            }
            auditLogService.log("LOGOUT", "Auth", userId, jwtService.extractUsername(accessToken), userId);
        } catch (RuntimeException ex) {
            log.warn("Failed to record LOGOUT audit entry", ex);
        }
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
            log.debug("Failed to increment metric counter: {}", name, ignored);
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

    @Transactional
    public void forgotPassword(ForgotPasswordRequest req, String clientIp) {
        String normalizedEmail = req.email().toLowerCase(Locale.ROOT).trim();

        // Rate-limit forgot-password requests per IP to prevent email enumeration
        if (clientIp != null && !clientIp.isBlank()) {
            OffsetDateTime windowStart = OffsetDateTime.now().minusMinutes(15);
            long recentAttempts = loginAttemptRepository
                    .countByIpAddressAndLastAttemptAtAfter(clientIp, windowStart);

            // Allow max 5 forgot-password requests per 15 min per IP
            if (recentAttempts > 5) {
                log.warn("Forgot-password rate limit: ip={}, attempts={} in 15min", clientIp, recentAttempts);
                incrementCounter("auth.forgot_password.failed", "reason", "rate_limited");
                throw new IllegalArgumentException("Too many password reset requests. Please try again later.");
            }

            // Check if IP is blocked
            var existingAttempt = loginAttemptRepository.findByIpAddress(clientIp);
            if (existingAttempt.isPresent() && existingAttempt.get().getBlockedUntil() != null
                    && OffsetDateTime.now().isBefore(existingAttempt.get().getBlockedUntil())) {
                long remainingSeconds = java.time.Duration.between(
                        OffsetDateTime.now(), existingAttempt.get().getBlockedUntil()).getSeconds();
                log.warn("IP blocked from forgot-password: ip={}, remainingSeconds={}", clientIp, remainingSeconds);
                incrementCounter("auth.forgot_password.failed", "reason", "ip_blocked");
                throw new IllegalArgumentException(
                        "Too many requests. Try again in " + remainingSeconds + " seconds.");
            }
        }

        // Record attempt regardless of whether email exists (prevents enumeration)
        // IMPORTANT: this must happen BEFORE any early return so the record is always persisted
        if (clientIp != null && !clientIp.isBlank()) {
            recordForgotPasswordAttempt(clientIp, normalizedEmail);
        }

        var existingUser = userRepository.findByEmail(normalizedEmail);
        if (existingUser.isEmpty()) {
            // Don't reveal whether email is registered — same message either way
            // Return without throwing so transaction commits and attempt is persisted
            log.info("Forgot-password requested for non-existent email={}", normalizedEmail);
            incrementCounter("auth.forgot_password.user_not_found");
            return;
        }

        User user = existingUser.get();
        String resetToken = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        user.setPasswordResetToken(resetToken);
        user.setPasswordResetTokenExpiry(OffsetDateTime.now().plusHours(1));
        userRepository.save(user);

        log.info("Password reset token generated for email={} tokenPrefix={}", normalizedEmail,
                resetToken.substring(0, 6));
        incrementCounter("auth.forgot_password.success");
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        if (req.newPassword() == null || req.newPassword().length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }

        User user = userRepository.findByPasswordResetToken(req.token())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token"));

        if (user.getPasswordResetTokenExpiry() == null
                || OffsetDateTime.now().isAfter(user.getPasswordResetTokenExpiry())) {
            throw new IllegalArgumentException("Reset token has expired. Please request a new one.");
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setPasswordResetToken(null);
        user.setPasswordResetTokenExpiry(null);
        userRepository.save(user);

        // 🔒 Revoke all existing refresh token sessions — password changed, so
        // any stolen refresh tokens must be invalidated immediately.
        int revoked = refreshTokenSessionRepository.revokeAllByUserAndRevokedFalse(user);
        if (revoked > 0) {
            log.info("Revoked {} stale refresh sessions for userId={} after password reset", revoked, user.getId());
        }

        incrementCounter("auth.reset_password.success");
        log.info("Password reset successful for userId={}", user.getId());
    }

    private void recordFailedAttempt(String clientIp, String email) {
        try {
            var attempt = loginAttemptRepository.findByIpAddress(clientIp)
                    .orElseGet(() -> {
                        LoginAttempt a = new LoginAttempt();
                        a.setIpAddress(clientIp);
                        return a;
                    });
            attempt.setAttemptCount(attempt.getAttemptCount() + 1);
            attempt.setLastAttemptAt(OffsetDateTime.now());
            attempt.setEmail(email);
            attempt.setExpiresAt(OffsetDateTime.now().plusHours(24));

            // Exponential backoff: block after 10, 20, 50, 100... attempts
            int count = attempt.getAttemptCount();
            if (count >= 100) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusHours(24));
            } else if (count >= 50) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusHours(4));
            } else if (count >= 20) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusMinutes(30));
            } else if (count >= 10) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusMinutes(5));
            } else {
                attempt.setBlockedUntil(null);
            }

            loginAttemptRepository.save(attempt);
        } catch (Exception ignored) {
            log.warn("Failed to record failed login attempt from ip={}", clientIp, ignored);
        }
    }

    private void recordForgotPasswordAttempt(String clientIp, String email) {
        try {
            var attempt = loginAttemptRepository.findByIpAddress(clientIp)
                    .orElseGet(() -> {
                        LoginAttempt a = new LoginAttempt();
                        a.setIpAddress(clientIp);
                        return a;
                    });
            attempt.setAttemptCount(attempt.getAttemptCount() + 1);
            attempt.setLastAttemptAt(OffsetDateTime.now());
            attempt.setEmail(email);
            attempt.setExpiresAt(OffsetDateTime.now().plusHours(24));

            // Rate-limit: block after 6, 12, 25, 50... attempts (lower threshold than login since
            // forgot-password is a sensitive enumration target)
            int count = attempt.getAttemptCount();
            if (count >= 50) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusHours(24));
            } else if (count >= 25) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusHours(4));
            } else if (count >= 12) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusMinutes(30));
            } else if (count >= 6) {
                attempt.setBlockedUntil(OffsetDateTime.now().plusMinutes(5));
            } else {
                attempt.setBlockedUntil(null);
            }

            loginAttemptRepository.save(attempt);
        } catch (Exception ignored) {
            log.warn("Failed to record forgot-password attempt from ip={}", clientIp, ignored);
        }
    }

    private String generateUsernameFromEmail(String email) {
        String base = email.contains("@") ? email.substring(0, email.indexOf('@')) : "user";
        base = base.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "_");
        if (base.length() < 3) base = base + "user";
        if (base.length() > 20) base = base.substring(0, 20);
        // Ensure uniqueness
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsername(candidate)
                || RESERVED_USERNAMES.contains(candidate)) {
            candidate = base + Math.min(suffix, 99);
            if (candidate.length() > 20) candidate = candidate.substring(0, 20);
            suffix++;
        }
        return candidate;
    }

    private String toCleanString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
