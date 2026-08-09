package com.skillswap.auth;

import com.skillswap.common.ApiClientException;
import com.skillswap.common.AuditLogService;
import com.skillswap.common.UsernameRules;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.skillswap.auth.AuthDtos.*;

/**
 * Service implementing auth business logic.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger LOG = LoggerFactory.getLogger(AuthService.class);

    /** Sliding window during which per-IP attempt counters are enforced. */
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);

    /**
     * Max failed attempts allowed per IP per {@link #ATTEMPT_WINDOW} before
     * login is rejected (5 allowed, the 6th is blocked).
     */
    private static final int MAX_LOGIN_ATTEMPTS = 5;

    /**
     * Max forgot-password requests allowed per IP per {@link #ATTEMPT_WINDOW}
     * before the flow is rejected (5 allowed, the 6th is blocked). Kept
     * separate from login so one flow cannot exhaust the other's quota.
     */
    private static final int MAX_FORGOT_PASSWORD_ATTEMPTS = 5;

    /**
     * Max OAuth login callbacks allowed per IP per {@link #ATTEMPT_WINDOW}
     * before the flow is rejected (10 allowed, the 11th is blocked). OAuth
     * callbacks fire only after the provider authenticates the user, but each
     * callback may create a brand-new account, so a single IP must not be
     * able to mass-create accounts through repeated OAuth flows.
     */
    private static final int MAX_OAUTH_LOGIN_ATTEMPTS = 10;

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9]"
                    + "(?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9]"
                    + "(?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$");

    private static final int MAX_EMAIL_LENGTH = 254;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    @Lazy
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final AccessTokenDenylistRepository accessTokenDenylistRepository;
    private final MeterRegistry meterRegistry;
    private final LoginAttemptRepository loginAttemptRepository;
    private final AuthAttemptRecorder attemptRecorder;
    private final AuditLogService auditLogService;
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Transactional
    public AuthResponse signup(SignupRequest req, String clientIp) {
        String normalizedEmail = req.email().toLowerCase(Locale.ROOT).trim();

        // Rate-limit signups per IP to prevent mass account creation
        if (clientIp != null && !clientIp.isBlank()) {
            OffsetDateTime windowStart = OffsetDateTime.now().minusMinutes(60);
            long recentSignups = loginAttemptRepository
                    .countByIpAddressAndLastAttemptAtAfter(clientIp, windowStart);
            if (recentSignups > 10) {
                LOG.warn("Signup rate limit: ip={}, signups={} in 60min", clientIp, recentSignups);
                incrementCounter("auth.signup.failed", "reason", "rate_limited");
                throw new IllegalArgumentException("Too many accounts created from this IP. Please try again later.");
            }
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
            incrementCounter("auth.signup.failed", "reason", "duplicate_email");
            throw new ApiClientException(HttpStatus.CONFLICT, "EMAIL_TAKEN",
                    "An account with this email already exists.", false);
        }

        if (req.role() == UserRole.ADMIN) {
            incrementCounter("auth.signup.failed", "reason", "admin_signup_blocked");
            throw new IllegalArgumentException(
                    "Admin accounts cannot be created via signup. Contact the platform administrator.");
        }

        // ── Username validation ──
        // Display value is preserved exactly as typed (GitHub-style);
        // uniqueness is enforced case-insensitively against username_lower.
        String displayUsername = req.username().trim();
        String normalizedUsername = displayUsername.toLowerCase(Locale.ROOT);
        UsernameRules.validateFormat(displayUsername);
        if (UsernameRules.isReserved(displayUsername)) {
            throw new IllegalArgumentException("This username is reserved. Please choose another one.");
        }
        if (userRepository.existsByUsernameLower(normalizedUsername)) {
            incrementCounter("auth.signup.failed", "reason", "duplicate_username");
            throw new ApiClientException(HttpStatus.CONFLICT, "USERNAME_TAKEN",
                    "This username is already taken. Please choose another username.", false);
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setUsername(displayUsername);
        user.setUsernameLower(normalizedUsername);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setFullName(req.fullName());
        user.setRole(req.role() == null ? UserRole.LEARNER : req.role());
        user.setWalletAddress(req.walletAddress());
        user.setLastActiveAt(OffsetDateTime.now());
        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            // Race-condition backstop: a concurrent signup claimed the same
            // email or username between our check and this insert. The DB
            // unique constraints are the final arbiter.
            incrementCounter("auth.signup.failed", "reason", "duplicate_race");
            throw new ApiClientException(HttpStatus.CONFLICT, "DUPLICATE_ACCOUNT",
                    "An account with this email or username already exists.", false);
        }

        String tokenId = UUID.randomUUID().toString();
        String token = jwtService.generateToken(user, tokenId);
        String refreshToken = jwtService.generateRefreshToken(user, tokenId);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.signup.success");
        recordSignup(user);
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name(),
                user.getDisplayUsername(), user.isProfileCompleted());
    }

    @Transactional
    public AuthResponse login(LoginRequest req, String clientIp) {
        String loginId = req.emailOrUsername().trim();

        // Detect if loginId is an email or username: a single "@" means the
        // user typed an email address, otherwise it is treated as a username.
        // Case is normalized for both — emails and usernames are
        // case-insensitive identifiers.
        boolean isEmail = loginId.contains("@");
        String normalizedEmail = isEmail ? loginId.toLowerCase(Locale.ROOT) : null;
        String normalizedUsername = isEmail ? null : loginId.toLowerCase(Locale.ROOT);

        // Brute-force protection: per-flow counter (LOGIN) with a 15-minute
        // sliding window plus a persistent lockout (exponential backoff). The
        // window check runs BEFORE this attempt is recorded, so exactly
        // MAX_LOGIN_ATTEMPTS failed attempts are allowed and the next request
        // is rejected. Blocked attempts are still recorded so the cumulative
        // counter keeps climbing and drives the backoff ladder in
        // AuthAttemptRecorder.recordFailedLogin (10 → 20 → 50 → 100).
        if (clientIp != null && !clientIp.isBlank()) {
            var existingAttempt = loginAttemptRepository
                    .findByIpAddressAndAttemptType(clientIp, AttemptType.LOGIN);
            if (existingAttempt.isPresent()) {
                LoginAttempt attempt = existingAttempt.get();

                // Persistent lockout from exponential backoff — checked first.
                if (attempt.getBlockedUntil() != null
                        && OffsetDateTime.now().isBefore(attempt.getBlockedUntil())) {
                    long remainingSeconds = Duration.between(
                            OffsetDateTime.now(), attempt.getBlockedUntil()).getSeconds();
                    LOG.warn("IP blocked: ip={}, remainingSeconds={}", clientIp, remainingSeconds);
                    incrementCounter("auth.login.failed", "reason", "ip_blocked");
                    throw new IllegalArgumentException(
                            "Too many failed attempts. Try again in " + remainingSeconds + " seconds.");
                }

                // 15-minute sliding window: block once the counter reaches the
                // threshold (5 failed attempts allowed, the 6th is rejected).
                if (attempt.getLastAttemptAt() != null
                        && attempt.getLastAttemptAt().isAfter(OffsetDateTime.now().minus(ATTEMPT_WINDOW))
                        && attempt.getAttemptCount() >= MAX_LOGIN_ATTEMPTS) {
                    LOG.warn("Brute-force block: ip={}, attempts={} in 15min", clientIp,
                            attempt.getAttemptCount());
                    attemptRecorder.recordFailedLogin(clientIp, loginId);
                    incrementCounter("auth.login.failed", "reason", "rate_limited");
                    throw new IllegalArgumentException("Too many login attempts. Please try again later.");
                }
            }
        }

        // Resolve the user by email or username (case-insensitive).
        User user = isEmail
                ? userRepository.findByEmail(normalizedEmail).orElse(null)
                : userRepository.findByUsernameLower(normalizedUsername).orElse(null);

        if (user == null) {
            if (clientIp != null && !clientIp.isBlank()) {
                attemptRecorder.recordFailedLogin(clientIp, isEmail ? normalizedEmail : normalizedUsername);
            }
            // Same 401 as a wrong password — keeps account existence
            // enumeration as hard as possible while still being actionable.
            throw new ApiClientException(HttpStatus.UNAUTHORIZED, "ACCOUNT_NOT_FOUND",
                    "No account found.", false);
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(user.getEmail(), req.password()));
        } catch (DisabledException ex) {
            if (clientIp != null && !clientIp.isBlank()) {
                attemptRecorder.recordFailedLogin(clientIp, user.getEmail());
            }
            throw new ApiClientException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED",
                    "Your account has been disabled. Please contact support.", false);
        } catch (BadCredentialsException ex) {
            if (clientIp != null && !clientIp.isBlank()) {
                attemptRecorder.recordFailedLogin(clientIp, user.getEmail());
            }
            throw new ApiClientException(HttpStatus.UNAUTHORIZED, "INVALID_PASSWORD",
                    "Incorrect password.", false);
        } catch (AuthenticationException ex) {
            if (clientIp != null && !clientIp.isBlank()) {
                attemptRecorder.recordFailedLogin(clientIp, user.getEmail());
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
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name(),
                user.getDisplayUsername(), user.isProfileCompleted());
    }

    @Transactional
    public AuthResponse loginWithOAuth(String provider, Map<String, Object> attributes, String clientIp) {
        // ── Validation ──
        if (provider == null || provider.isBlank()) {
            incrementCounter("auth.oauth.failed", "reason", "invalid_provider");
            throw new IllegalArgumentException("OAuth provider is required");
        }
        if (attributes == null) {
            incrementCounter("auth.oauth.failed", "reason", "missing_attributes");
            throw new IllegalArgumentException("OAuth attributes are missing");
        }

        // OAuth logins are throttled per IP so a single IP cannot mass-create
        // accounts through repeated provider callbacks. The window check runs
        // BEFORE this callback is recorded, so exactly MAX_OAUTH_LOGIN_ATTEMPTS
        // callbacks are allowed per window and the next one is rejected.
        if (clientIp != null && !clientIp.isBlank()) {
            var existingAttempt = loginAttemptRepository
                    .findByIpAddressAndAttemptType(clientIp, AttemptType.OAUTH_LOGIN);
            if (existingAttempt.isPresent()) {
                LoginAttempt attempt = existingAttempt.get();

                // Persistent lockout from the backoff ladder — checked first.
                if (attempt.getBlockedUntil() != null
                        && OffsetDateTime.now().isBefore(attempt.getBlockedUntil())) {
                    long remainingSeconds = Duration.between(
                            OffsetDateTime.now(), attempt.getBlockedUntil()).getSeconds();
                    LOG.warn("IP blocked from OAuth login: ip={}, remainingSeconds={}",
                            clientIp, remainingSeconds);
                    incrementCounter("auth.oauth.failed", "reason", "ip_blocked");
                    throw new IllegalArgumentException(
                            "Too many sign-in attempts. Try again in " + remainingSeconds + " seconds.");
                }

                if (attempt.getLastAttemptAt() != null
                        && attempt.getLastAttemptAt().isAfter(OffsetDateTime.now().minus(ATTEMPT_WINDOW))
                        && attempt.getAttemptCount() >= MAX_OAUTH_LOGIN_ATTEMPTS) {
                    LOG.warn("OAuth rate limit: ip={}, attempts={} in 15min", clientIp,
                            attempt.getAttemptCount());
                    attemptRecorder.recordOAuthLogin(clientIp, "<oauth>");
                    incrementCounter("auth.oauth.failed", "reason", "rate_limited");
                    throw new IllegalArgumentException("Too many sign-in attempts. Please try again later.");
                }
            }
        }

        String email = extractOAuthEmail(provider, attributes).toLowerCase(Locale.ROOT);

        // Validate the provider-supplied email before it can be used to create
        // or attach to an account — never trust provider attributes blindly.
        if (email == null || email.isBlank() || email.length() > MAX_EMAIL_LENGTH
                || !EMAIL_PATTERN.matcher(email).matches()) {
            incrementCounter("auth.oauth.failed", "reason", "invalid_email");
            throw new IllegalArgumentException("Unable to read a valid email from OAuth provider");
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = new User();
            created.setEmail(email);
            created.setUsername(generateUsernameFromEmail(email));
            created.setFullName(extractDisplayName(attributes, email));
            created.setRole(UserRole.LEARNER);
            created.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            created.setLastActiveAt(OffsetDateTime.now());
            return userRepository.save(created);
        });

        // ── Account enabled check ──
        // A disabled (banned/deactivated) account must not be able to sign in
        // through OAuth, exactly as it cannot via password login (where Spring
        // Security's DaoAuthenticationProvider rejects disabled users).
        if (!user.isEnabled()) {
            LOG.warn("OAuth login blocked for disabled account: email={}", email);
            if (clientIp != null && !clientIp.isBlank()) {
                attemptRecorder.recordOAuthLogin(clientIp, email);
            }
            incrementCounter("auth.oauth.failed", "reason", "account_disabled");
            throw new IllegalArgumentException("Your account has been disabled. Please contact support.");
        }

        if (clientIp != null && !clientIp.isBlank()) {
            attemptRecorder.recordOAuthLogin(clientIp, email);
        }

        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        String tokenId = UUID.randomUUID().toString();
        String token = jwtService.generateToken(user, tokenId);
        String refreshToken = jwtService.generateRefreshToken(user, tokenId);
        persistRefreshSession(user, refreshToken);
        incrementCounter("auth.oauth.success", "provider", provider.toLowerCase(Locale.ROOT));
        recordAuthEvent("LOGIN", user);
        return new AuthResponse(token, refreshToken, user.getEmail(), user.getRole().name(),
                user.getDisplayUsername(), user.isProfileCompleted());
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
        // Pessimistic write lock (SELECT ... FOR UPDATE) on the session row:
        // concurrent refreshes with the same token serialize here, so exactly
        // one rotation wins and every other request sees the row already
        // revoked — replaying a used/rotated refresh token is rejected.
        RefreshTokenSession tokenSession = refreshTokenSessionRepository
                .findActiveByTokenIdForUpdate(tokenId, OffsetDateTime.now(ZoneOffset.UTC))
                .orElse(null);
        if (tokenSession == null) {
            // Token reuse / theft detection: a refresh token was presented that
            // is already revoked or expired. If a session row exists at all, the
            // token was previously rotated (revoked) — replaying it is a strong
            // signal the token was stolen, so revoke the user's ENTIRE session
            // family (all devices) instead of just rejecting this one request.
            if (refreshTokenSessionRepository.existsByTokenId(tokenId)) {
                // Runs in a REQUIRES_NEW transaction so the family revocation
                // commits even though this method throws (which would otherwise
                // roll the whole @Transactional method back).
                revokeSessionFamilyOnReuse(user);
            }
            throw new IllegalArgumentException("Refresh token was revoked or expired");
        }
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
        return new AuthResponse(newAccessToken, rotatedRefreshToken, user.getEmail(),
                user.getRole().name(), user.getDisplayUsername(), user.isProfileCompleted());
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
            auditLogService.logEvent(action, AuditLogService.MOD_AUTH,
                    AuditLogService.SEV_SUCCESS, "SUCCESS",
                    "User", user.getId(),
                    action + " for " + user.getEmail() + " (" + user.getRole().name() + ")",
                    null, null, user.getId());
        } catch (RuntimeException ex) {
            LOG.warn("Failed to record {} audit entry for userId={}", action, user.getId(), ex);
        }
    }

    /** Records a USER_CREATED audit entry on successful signup. */
    private void recordSignup(User user) {
        try {
            auditLogService.logEvent("USER_CREATED", AuditLogService.MOD_USER,
                    AuditLogService.SEV_SUCCESS, "SUCCESS",
                    "User", user.getId(),
                    "Account created for " + user.getEmail() + " as " + user.getRole().name(),
                    null, null, user.getId());
        } catch (RuntimeException ex) {
            LOG.warn("Failed to record USER_CREATED audit entry for userId={}", user.getId(), ex);
        }
    }

    /** Records a PASSWORD_RESET audit entry on successful password reset. */
    private void recordPasswordReset(User user) {
        try {
            auditLogService.logEvent("PASSWORD_RESET", AuditLogService.MOD_AUTH,
                    AuditLogService.SEV_WARNING, "SUCCESS",
                    "User", user.getId(),
                    "Password reset completed for " + user.getEmail(),
                    null, null, user.getId());
        } catch (RuntimeException ex) {
            LOG.warn("Failed to record PASSWORD_RESET audit entry for userId={}", user.getId(), ex);
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
            LOG.warn("Failed to record LOGOUT audit entry", ex);
        }
    }

    private void persistRefreshSession(User user, String refreshToken) {
        RefreshTokenSession tokenSession = new RefreshTokenSession();
        tokenSession.setUser(user);
        tokenSession.setTokenId(jwtService.extractTokenId(refreshToken));
        tokenSession.setExpiresAt(jwtService.extractAllClaims(refreshToken).getExpiration().toInstant()
                .atOffset(ZoneOffset.UTC));
        refreshTokenSessionRepository.save(tokenSession);
    }

    private void incrementCounter(String name, String... tags) {
        try {
            meterRegistry.counter(name, tags).increment();
        } catch (RuntimeException ignored) {
            LOG.debug("Failed to increment metric counter: {}", name, ignored);
        }
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

        // Rate-limit forgot-password requests per IP to prevent email
        // enumeration. Uses its OWN counter (AttemptType.FORGOT_PASSWORD), so
        // login failures never exhaust the password-reset quota (and vice
        // versa). The window check runs BEFORE the attempt is recorded: exactly
        // MAX_FORGOT_PASSWORD_ATTEMPTS requests are allowed per 15 min and the
        // next is rejected. Blocked requests are still recorded so the
        // cumulative counter drives the backoff ladder in
        // AuthAttemptRecorder.recordForgotPassword (6 → 12 → 25 → 50).
        if (clientIp != null && !clientIp.isBlank()) {
            var existingAttempt = loginAttemptRepository
                    .findByIpAddressAndAttemptType(clientIp, AttemptType.FORGOT_PASSWORD);
            if (existingAttempt.isPresent()) {
                LoginAttempt attempt = existingAttempt.get();

                // Persistent lockout from exponential backoff — checked first.
                if (attempt.getBlockedUntil() != null
                        && OffsetDateTime.now().isBefore(attempt.getBlockedUntil())) {
                    long remainingSeconds = Duration.between(
                            OffsetDateTime.now(), attempt.getBlockedUntil()).getSeconds();
                    LOG.warn("IP blocked from forgot-password: ip={}, remainingSeconds={}",
                            clientIp, remainingSeconds);
                    incrementCounter("auth.forgot_password.failed", "reason", "ip_blocked");
                    throw new IllegalArgumentException(
                            "Too many requests. Try again in " + remainingSeconds + " seconds.");
                }

                // 15-minute sliding window: block once the counter reaches the
                // threshold (5 requests allowed, the 6th is rejected).
                if (attempt.getLastAttemptAt() != null
                        && attempt.getLastAttemptAt().isAfter(OffsetDateTime.now().minus(ATTEMPT_WINDOW))
                        && attempt.getAttemptCount() >= MAX_FORGOT_PASSWORD_ATTEMPTS) {
                    LOG.warn("Forgot-password rate limit: ip={}, attempts={} in 15min", clientIp,
                            attempt.getAttemptCount());
                    attemptRecorder.recordForgotPassword(clientIp, normalizedEmail);
                    incrementCounter("auth.forgot_password.failed", "reason", "rate_limited");
                    throw new IllegalArgumentException("Too many password reset requests. Please try again later.");
                }
            }
        }

        // Record attempt regardless of whether email exists (prevents enumeration)
        // IMPORTANT: this must happen BEFORE any early return so the record is always persisted
        if (clientIp != null && !clientIp.isBlank()) {
            attemptRecorder.recordForgotPassword(clientIp, normalizedEmail);
        }

        var existingUser = userRepository.findByEmail(normalizedEmail);
        if (existingUser.isEmpty()) {
            // Don't reveal whether email is registered — same message either way
            // Return without throwing so transaction commits and attempt is persisted
            LOG.info("Forgot-password requested for non-existent email={}", normalizedEmail);
            incrementCounter("auth.forgot_password.user_not_found");
            return;
        }

        User user = existingUser.get();
        String resetToken = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        // Store only a one-way SHA-256 hash of the reset token — the plaintext
        // token is never persisted, so a DB leak cannot be used to reset
        // passwords. The plaintext is returned to the caller/email as before.
        user.setPasswordResetToken(hashResetToken(resetToken));
        user.setPasswordResetTokenExpiry(OffsetDateTime.now().plusHours(1));
        userRepository.save(user);

        LOG.info("Password reset token generated for email={} tokenPrefix={}", normalizedEmail,
                resetToken.substring(0, 6));
        incrementCounter("auth.forgot_password.success");
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        if (!isStrongPassword(req.newPassword())) {
            throw new IllegalArgumentException(PASSWORD_POLICY_MESSAGE);
        }

        User user = userRepository.findByPasswordResetToken(hashResetToken(req.token()))
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
            LOG.info("Revoked {} stale refresh sessions for userId={} after password reset", revoked, user.getId());
        }

        incrementCounter("auth.reset_password.success");
        recordPasswordReset(user);
        LOG.info("Password reset successful for userId={}", user.getId());
    }

    /**
     * Revokes every active refresh session for a user. Called when a refresh
     * token replay is detected; runs in a fresh transaction (TransactionTemplate)
     * so the revocation is committed even though the caller throws afterwards
     * (a RuntimeException would otherwise roll the whole @Transactional
     * refreshToken method back).
     */
    void revokeSessionFamilyOnReuse(User user) {
        // REQUIRES_NEW: run in a separate, immediately-committed transaction so
        // the family revocation is durable even though the calling refreshToken
        // method throws a RuntimeException afterwards (which would otherwise
        // roll the whole outer transaction back, undoing the revocation).
        org.springframework.transaction.support.TransactionTemplate tx =
                new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.executeWithoutResult(status -> {
            int revoked = refreshTokenSessionRepository.revokeAllByUserAndRevokedFalse(user);
            if (revoked > 0) {
                LOG.warn("Refresh token reuse detected for userId={}; revoked {} active sessions",
                        user.getId(), revoked);
            }
        });
    }

    /** Password policy shared with AuthDtos.SignupRequest validation. */
    private static final String PASSWORD_POLICY_MESSAGE =
            "Password must be at least 8 characters and include uppercase, lowercase, and a digit";

    private static final java.util.regex.Pattern PASSWORD_PATTERN =
            java.util.regex.Pattern.compile("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,64}$");

    static boolean isStrongPassword(String password) {
        return password != null && PASSWORD_PATTERN.matcher(password).matches();
    }

    /**
     * One-way SHA-256 hex digest used for password-reset token storage. The
     * reset token sent to the user is high-entropy (UUID), so hashing it with
     * a plain digest is sufficient — no salt/iteration needed.
     */
    static String hashResetToken(String token) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private String generateUsernameFromEmail(String email) {
        String base = email.contains("@") ? email.substring(0, email.indexOf('@')) : "user";
        base = base.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "_");
        if (base.length() < UsernameRules.MIN_LENGTH) {
            base = base + "user";
        }
        if (base.length() > UsernameRules.MAX_LENGTH) {
            base = base.substring(0, UsernameRules.MAX_LENGTH);
        }
        // Ensure uniqueness (case-insensitive)
        String candidate = base;
        int suffix = 1;
        while (userRepository.existsByUsernameLower(candidate)
                || UsernameRules.isReserved(candidate)) {
            candidate = base + Math.min(suffix, 99);
            if (candidate.length() > UsernameRules.MAX_LENGTH) {
                candidate = candidate.substring(0, UsernameRules.MAX_LENGTH);
            }
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
