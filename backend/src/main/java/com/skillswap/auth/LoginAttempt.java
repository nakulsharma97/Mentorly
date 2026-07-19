package com.skillswap.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Tracks failed login attempts per IP address for brute-force protection.
 * The AuthService uses this to enforce exponential backoff.
 */
@Entity
@Table(name = "login_attempts")
@Getter
@Setter
public class LoginAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 1;

    @Column(name = "last_attempt_at", nullable = false)
    private OffsetDateTime lastAttemptAt = OffsetDateTime.now();

    @Column(name = "blocked_until")
    private OffsetDateTime blockedUntil;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
}
