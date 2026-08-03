package com.skillswap.auth;

import com.skillswap.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Persists per-IP authentication attempt counters (and their audit trail) in a
 * transaction that is INDEPENDENT of the auth flow's own transaction.
 *
 * <p>Failed logins throw inside an {@code @Transactional} service method,
 * which rolls the surrounding transaction back — including any attempt record
 * saved there. Writing the counter in a {@code REQUIRES_NEW} transaction makes
 * the record survive the rollback, so brute-force throttling actually
 * accumulates. Blocked attempts are recorded too, which keeps the cumulative
 * counter climbing and drives the exponential-backoff lockout ladder.
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

    private final LoginAttemptRepository loginAttemptRepository;
    private final AuditLogService auditLogService;

    /** Failed (or blocked) password login attempt — increments the LOGIN counter. */
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
            LOG.warn("Failed to record failed login attempt from ip={}", clientIp, ignored);
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
            attempt.setAttemptCount(attempt.getAttemptCount() + 1);
            attempt.setLastAttemptAt(OffsetDateTime.now());
            attempt.setEmail(email);
            attempt.setExpiresAt(OffsetDateTime.now().plusHours(24));

            // Lower threshold than login since forgot-password is a sensitive
            // enumeration target: block after 6, 12, 25, 50... attempts
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
            attempt.setAttemptCount(attempt.getAttemptCount() + 1);
            attempt.setLastAttemptAt(OffsetDateTime.now());
            attempt.setEmail(email);
            attempt.setExpiresAt(OffsetDateTime.now().plusHours(24));

            // Same exponential backoff ladder as login: block after 10, 20,
            // 50, 100... OAuth callbacks from one IP within a short window.
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
            LOG.warn("Failed to record OAuth login attempt from ip={}", clientIp, ignored);
        }
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
