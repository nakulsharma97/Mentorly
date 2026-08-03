package com.skillswap.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Tracks failed login / forgot-password attempts per IP address for
 * brute-force protection. The AuthService uses this to enforce exponential
 * backoff. Each authentication flow keeps its own row (and counter), keyed by
 * {@link AttemptType}, so flows never exhaust each other's quotas.
 */
/**
 * Encapsulates login attempt.
 */
@Entity
@Table(name = "login_attempts")
@Getter
@Setter
public class LoginAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "attempt_type", nullable = false, length = 20)
    private AttemptType attemptType = AttemptType.LOGIN;

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "last_attempt_at", nullable = false)
    private OffsetDateTime lastAttemptAt = OffsetDateTime.now();

    @Column(name = "blocked_until")
    private OffsetDateTime blockedUntil;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
}
