package com.skillswap.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Repository for email verification OTPs.
 */
@Repository
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

    /**
     * Find the latest unverified OTP for an email.
     */
    Optional<EmailVerification> findTopByEmailOrderByCreatedAtDesc(String email);

    /**
     * Find a specific OTP by email and OTP value.
     */
    Optional<EmailVerification> findByEmailAndOtp(String email, String otp);

    /**
     * Mark all previous OTPs for an email as verified (invalidates old ones).
     */
    @Modifying
    @Query("UPDATE EmailVerification ev SET ev.verified = true WHERE ev.email = :email AND ev.verified = false")
    void invalidateAllByEmail(String email);

    /**
     * Delete expired OTPs older than a certain time.
     */
    @Modifying
    @Query("DELETE FROM EmailVerification ev WHERE ev.createdAt < :cutoff")
    void deleteExpiredBefore(OffsetDateTime cutoff);
}
