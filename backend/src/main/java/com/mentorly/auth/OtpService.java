package com.mentorly.auth;

import com.mentorly.notification.EmailNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Service for generating, sending, and verifying OTPs for email verification.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int OTP_LENGTH = 6;
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_RESEND_COUNT = 5;

    private final EmailVerificationRepository emailVerificationRepository;
    private final EmailNotificationService emailNotificationService;

    /**
     * Generate and send a new OTP for email verification.
     *
     * @param email the email to send OTP to
     * @return the generated OTP (for testing only - never expose to client)
     */
    @Transactional
    public String generateAndSendOtp(String email) {
        // Invalidate any existing unverified OTPs for this email
        emailVerificationRepository.invalidateAllByEmail(email.toLowerCase());

        // Generate 6-digit OTP
        String otp = generateOtp();

        // Create verification record
        EmailVerification verification = new EmailVerification();
        verification.setEmail(email.toLowerCase());
        verification.setOtp(otp);
        verification.setExpiresAt(OffsetDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        verification.setVerified(false);
        verification.setAttemptCount(0);
        verification.setResendCount(0);
        verification.setLastResendAt(OffsetDateTime.now());

        emailVerificationRepository.save(verification);

        // Send OTP email
        sendOtpEmail(email, otp);

        log.info("OTP generated for email={}, otpPrefix={}", email, otp.substring(0, 3));
        return otp;
    }

    /**
     * Verify an OTP for email verification.
     *
     * @param email the email to verify
     * @param otp   the OTP to verify
     * @return true if verification successful
     * @throws IllegalArgumentException if OTP is invalid, expired, or max attempts exceeded
     */
    @Transactional
    public boolean verifyOtp(String email, String otp) {
        Optional<EmailVerification> verificationOpt = emailVerificationRepository
                .findTopByEmailOrderByCreatedAtDesc(email.toLowerCase());

        if (verificationOpt.isEmpty()) {
            throw new IllegalArgumentException("No verification code found. Please request a new code.");
        }

        EmailVerification verification = verificationOpt.get();

        // Check if already verified
        if (verification.isVerified()) {
            throw new IllegalArgumentException("This code has already been used. Please request a new code.");
        }

        // Check if expired
        if (verification.isExpired()) {
            throw new IllegalArgumentException("This verification code has expired. Please request a new code.");
        }

        // Check max attempts
        if (verification.isMaxAttemptsExceeded()) {
            throw new IllegalArgumentException("Too many verification attempts. Please request a new code.");
        }

        // Increment attempt count
        verification.setAttemptCount(verification.getAttemptCount() + 1);
        emailVerificationRepository.save(verification);

        // Verify OTP
        if (!verification.getOtp().equals(otp)) {
            throw new IllegalArgumentException("Invalid verification code. Please try again.");
        }

        // Mark as verified
        verification.setVerified(true);
        emailVerificationRepository.save(verification);

        log.info("OTP verified for email={}", email);
        return true;
    }

    /**
     * Resend OTP for email verification.
     *
     * @param email the email to resend OTP to
     * @return the new OTP (for testing only)
     * @throws IllegalArgumentException if resend cooldown not met or max resends exceeded
     */
    @Transactional
    public String resendOtp(String email) {
        Optional<EmailVerification> verificationOpt = emailVerificationRepository
                .findTopByEmailOrderByCreatedAtDesc(email.toLowerCase());

        if (verificationOpt.isPresent()) {
            EmailVerification verification = verificationOpt.get();

            // Check resend cooldown
            if (!verification.canResend()) {
                throw new IllegalArgumentException("Please wait before requesting a new code.");
            }

            // Check max resend count
            if (verification.getResendCount() >= MAX_RESEND_COUNT) {
                throw new IllegalArgumentException("Too many resend requests. Please try again later.");
            }

            // Update resend count
            verification.setResendCount(verification.getResendCount() + 1);
            verification.setLastResendAt(OffsetDateTime.now());
            emailVerificationRepository.save(verification);
        }

        // Generate and send new OTP
        return generateAndSendOtp(email);
    }

    /**
     * Check if an email has a verified OTP.
     */
    @Transactional(readOnly = true)
    public boolean isEmailVerified(String email) {
        return emailVerificationRepository.findTopByEmailOrderByCreatedAtDesc(email.toLowerCase())
                .map(EmailVerification::isVerified)
                .orElse(false);
    }

    /**
     * Generate a 6-digit OTP.
     */
    private String generateOtp() {
        int otp = SECURE_RANDOM.nextInt(900000) + 100000; // 100000-999999
        return String.valueOf(otp);
    }

    /**
     * Send OTP email to user.
     */
    private void sendOtpEmail(String email, String otp) {
        String subject = "Verify your Mentorly account";
        String body = "Your Mentorly verification code is " + otp + ".\n\n"
                + "This code will expire in " + OTP_EXPIRY_MINUTES + " minutes.\n\n"
                + "If you did not request this verification, you can safely ignore this email.";

        try {
            emailNotificationService.sendRawEmail(email, subject, body);
            log.info("OTP email sent to {}", email);
        } catch (Exception e) {
            log.error("Failed to send OTP email to {}: {}", email, e.getMessage());
            throw new RuntimeException("Unable to send verification email. Please try again.");
        }
    }
}
