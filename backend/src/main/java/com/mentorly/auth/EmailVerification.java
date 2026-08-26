package com.mentorly.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

/**
 * Stores email verification OTPs for signup flow.
 */
@Getter
@Setter
@Entity
@Table(name = "email_verifications", indexes = {
        @Index(name = "idx_ev_email", columnList = "email"),
        @Index(name = "idx_ev_otp", columnList = "otp")
})
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false, length = 6)
    private String otp;

    @Column(nullable = false)
    private OffsetDateTime expiresAt;

    @Column(nullable = false)
    private boolean verified = false;

    @Column(nullable = false)
    private int attemptCount = 0;

    @Column(nullable = false)
    private int resendCount = 0;

    @Column(nullable = false)
    private OffsetDateTime lastResendAt;

    @CreationTimestamp
    @Column(updatable = false)
    private OffsetDateTime createdAt;

    /**
     * Check if OTP has expired.
     */
    public boolean isExpired() {
        return OffsetDateTime.now().isAfter(expiresAt);
    }

    /**
     * Check if max attempts exceeded (5 attempts).
     */
    public boolean isMaxAttemptsExceeded() {
        return attemptCount >= 5;
    }

    /**
     * Check if resend is allowed (60 second cooldown).
     */
    public boolean canResend() {
        if (lastResendAt == null) return true;
        return OffsetDateTime.now().isAfter(lastResendAt.plusSeconds(60));
    }
}
