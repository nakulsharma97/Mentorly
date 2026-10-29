package com.mentorly.auth;

import com.mentorly.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Persists per-IP authentication attempt counters (and their audit trail) in a
 * transaction that is INDEPENDENT of the auth flow's own transaction.
 *
 * <p>Failed logins throw inside an {@code @Transactional} service method,
 * which rolls the surrounding transaction back — including any attempt record
 * saved there. Writing the counter in a {@code REQUIRES_NEW} transaction makes
 * the record survive the rollback, so brute-force throttling actually
 * accumulates. Only attempts that are actually evaluated are recorded: an
 * already-blocked request is rejected by {@code AuthService} without touching
 * the counter, so hammering Sign In cannot push the window forward forever.
 *
 * <p>Login and forgot-password each keep their own row (keyed by
 * {@link AttemptType}) so one flow can never exhaust the other's quota.
 */
/**
 * Encapsulates auth attempt recorder.
 */
@Service
@RequiredArgsConstructor
public class AuthAttemptRecorder {

    private static final Logger LOG = LoggerFactory.getLogger(AuthAttemptRecorder.class);

    /** Sliding window after which an accumulated counter starts over. */
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);

    private final LoginAttemptRepository loginAttemptRepository;
    private final AuditLogService auditLogService;

    /** Failed password login attempt — increments the LOGIN counter. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedLogin(String clientIp, String email) {
        auditFailedLogin(email, clientIp);
        try {
            LoginAttempt attempt = loginAttemptRepository
                    .findByIpAddressAndAttemptType(clientIp, AttemptType.LOGIN)
                    .orElseGet(() -> {
                        LoginAttempt a = new LoginAttempt();
                        a.setIpAddress(clientIp);
                        a.setAttemptType(AttemptType.LOGIN);
                        return a;
                    });
            OffsetDateTime now = OffsetDateTime.now();
            attempt.setAttemptCount(countWithinWindow(attempt, now) + 1);
            attempt.setLastAttemptAt(now);
            attempt.setEmail(email);
            attempt.setExpiresAt(now.plusHours(24));

            // Exponential backoff: block after 10, 20, 50, 100... attempts
            int count = attempt.getAttemptCount();
            if (count >= 100) {
                attempt.setBlockedUntil(now.plusHours(24));
            } else if (count >= 50) {
                attempt.setBlockedUntil(now.plusHours(4));
            } else if (count >= 20) {
                attempt.setBlockedUntil(now.plusMinutes(30));
            } else if (count >= 10) {
                attempt.setBlockedUntil(now.plusMinutes(5));
            } else {
                attempt.setBlockedUntil(null);
            }

            loginAttemptRepository.save(attempt);
        } catch (Exception ignored) {
            LOG.warn("Failed to record failed login attempt from ip={}", clientIp, ignored);
        }
    }

    /**
     * Clears the LOGIN counter for an IP after a successful sign-in.
     *
     * <p>Runs in its own transaction for the same reason as the failure
     * counter: the outer auth transaction may still roll back afterwards, but a
     * credential check that already succeeded must not leave the user one
     * wrong password away from a lockout. Best-effort — a failure here only
     * means the old counter survives its window.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void resetLoginAttempts(String clientIp) {
        try {
            int removed = loginAttemptRepository.deleteByIpAddressAndAttemptType(clientIp, AttemptType.LOGIN);
            if (removed > 0) {
                LOG.info("Reset failed-login counter after successful login: ip={}, cleared={}",
                        clientIp, removed);
            }
        } catch (Exception ex) {
            LOG.warn("Failed to reset failed-login counter for ip={}", clientIp, ex);
        }
    }

    /** Forgot-password request attempt — increments the FORGOT_PASSWORD counter. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordForgotPassword(String clientIp, String email) {
        try {
            LoginAttempt attempt = loginAttemptRepository
                    .findByIpAddressAndAttemptType(clientIp, AttemptType.FORGOT_PASSWORD)
                    .orElseGet(() -> {
                        LoginAttempt a = new LoginAttempt();
                        a.setIpAddress(clientIp);
                        a.setAttemptType(AttemptType.FORGOT_PASSWORD);
                        return a;
                    });
            OffsetDateTime now = OffsetDateTime.now();
            attempt.setAttemptCount(countWithinWindow(attempt, now) + 1);
            attempt.setLastAttemptAt(now);
            attempt.setEmail(email);
            attempt.setExpiresAt(now.plusHours(24));

            // Lower threshold than login since forgot-password is a sensitive
            // enumeration target: block after 6, 12, 25, 50... attempts
            int count = attempt.getAttemptCount();
            if (count >= 50) {
                attempt.setBlockedUntil(now.plusHours(24));
            } else if (count >= 25) {
                attempt.setBlockedUntil(now.plusHours(4));
            } else if (count >= 12) {
                attempt.setBlockedUntil(now.plusMinutes(30));
            } else if (count >= 6) {
                attempt.setBlockedUntil(now.plusMinutes(5));
            } else {
                attempt.setBlockedUntil(null);
            }

            loginAttemptRepository.save(attempt);
        } catch (Exception ignored) {
            LOG.warn("Failed to record forgot-password attempt from ip={}", clientIp, ignored);
        }
    }

    /**
     * OAuth2 login / account creation attempt — increments the OAUTH_LOGIN
     * counter. OAuth logins each fire a new provider-authenticated callback
     * (and may create an account), so the counter prevents a single IP from
     * mass-creating accounts through repeated OAuth flows.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOAuthLogin(String clientIp, String email) {
        try {
            LoginAttempt attempt = loginAttemptRepository
                    .findByIpAddressAndAttemptType(clientIp, AttemptType.OAUTH_LOGIN)
                    .orElseGet(() -> {
                        LoginAttempt a = new LoginAttempt();
                        a.setIpAddress(clientIp);
                        a.setAttemptType(AttemptType.OAUTH_LOGIN);
                        return a;
                    });
            OffsetDateTime now = OffsetDateTime.now();
            attempt.setAttemptCount(countWithinWindow(attempt, now) + 1);
            attempt.setLastAttemptAt(now);
            attempt.setEmail(email);
            attempt.setExpiresAt(now.plusHours(24));

            // Same exponential backoff ladder as login: block after 10, 20,
            // 50, 100... OAuth callbacks from one IP within a short window.
            int count = attempt.getAttemptCount();
            if (count >= 100) {
                attempt.setBlockedUntil(now.plusHours(24));
            } else if (count >= 50) {
                attempt.setBlockedUntil(now.plusHours(4));
            } else if (count >= 20) {
                attempt.setBlockedUntil(now.plusMinutes(30));
            } else if (count >= 10) {
                attempt.setBlockedUntil(now.plusMinutes(5));
            } else {
                attempt.setBlockedUntil(null);
            }

            loginAttemptRepository.save(attempt);
        } catch (Exception ignored) {
            LOG.warn("Failed to record OAuth login attempt from ip={}", clientIp, ignored);
        }
    }

    /**
     * Returns the attempt count that still counts toward the CURRENT window.
     *
     * <p>Once the last attempt is older than {@link #ATTEMPT_WINDOW}, the
     * previous failures are history: the counter restarts at 0 and any backoff
     * lock armed in that older window is dropped. Without this, a stale row
     * (rows live for 24h and are only deleted after that) would make the very
     * first wrong password after a quiet 15 minutes look like the sixth.
     */
    private static int countWithinWindow(LoginAttempt attempt, OffsetDateTime now) {
        if (attempt.getAttemptCount() <= 0) {
            return 0;
        }
        OffsetDateTime lastAttemptAt = attempt.getLastAttemptAt();
        if (lastAttemptAt != null && !lastAttemptAt.isBefore(now.minus(ATTEMPT_WINDOW))) {
            return attempt.getAttemptCount();
        }
        attempt.setBlockedUntil(null);
        return 0;
    }

    /** Best-effort FAILED_LOGIN audit entry (severity CRITICAL, outcome FAILURE). */
    private void auditFailedLogin(String email, String clientIp) {
        try {
            auditLogService.logEvent("FAILED_LOGIN", AuditLogService.MOD_SECURITY,
                    AuditLogService.SEV_CRITICAL, "FAILURE",
                    "User", null,
                    "Failed login attempt for " + email + " from IP " + clientIp,
                    null, null, null);
        } catch (RuntimeException ex) {
            LOG.warn("Failed to record FAILED_LOGIN audit entry", ex);
        }
    }
}
