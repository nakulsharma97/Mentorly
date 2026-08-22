package com.skillswap.auth;

import com.skillswap.user.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Encapsulates auth dtos.
 */
public class AuthDtos {

/**
 * Immutable data carrier for signup request.
 */
        public record SignupRequest(
                        @Email @NotBlank String email,
                        @NotBlank
                        @Size(min = 8, max = 64, message = "Password must be 8\u201364 characters")
                        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
                                message = "Password must include uppercase, lowercase, and a digit")
                        String password,
                        @NotBlank String fullName,
                        @NotBlank
                        @Size(min = 4, max = 30, message = "Username must be 4\u201330 characters")
                        @Pattern(regexp = "^[A-Za-z0-9._-]{4,30}$",
                                message = "Username may only contain letters, numbers, and . _ -")
                        String username,
                        UserRole role,
                        String walletAddress) {
        }

/**
 * Immutable data carrier for login request.
 *
 * A single {@code emailOrUsername} field lets users sign in with either
 * their email address or their unique username (GitHub/LinkedIn/Discord
 * style). The legacy {@code email} key is still accepted via
 * {@code @JsonAlias} so existing clients keep working unchanged.
 */
        public record LoginRequest(
                        @NotBlank
                        @com.fasterxml.jackson.annotation.JsonAlias("email")
                        String emailOrUsername,
                        @NotBlank String password) {
        }

/**
 * Immutable data carrier for auth response.
 */
        public record AuthResponse(String token, String refreshToken, String email, String role, String username,
                        Boolean profileCompleted) {
        }

/**
 * Immutable data carrier for auth session response.
 */
        public record AuthSessionResponse(String email, String role, String token,
                String refreshToken, String username, Boolean profileCompleted) {
        }

/**
 * Immutable data carrier for refresh token request.
 */
        public record RefreshTokenRequest(
                        @NotBlank String refreshToken) {
        }

/**
 * Immutable data carrier for logout all response.
 */
        public record LogoutAllResponse(int revokedSessions) {
        }

/**
 * Immutable data carrier for logout response.
 */
        public record LogoutResponse(int revokedSessions) {
        }

/**
 * Immutable data carrier for forgot password request.
 */
        public record ForgotPasswordRequest(
                        @Email String email) {
        }

/**
 * Immutable data carrier for reset password request.
 */
        public record ResetPasswordRequest(
                        @NotBlank String token,
                        @NotBlank String newPassword) {
        }

/**
 * Immutable data carrier for send verification OTP request.
 */
        public record SendOtpRequest(
                        @Email @NotBlank String email,
                        @NotBlank String fullName,
                        @NotBlank String username,
                        @NotBlank String password,
                        UserRole role,
                        String walletAddress) {
        }

/**
 * Immutable data carrier for verify email OTP request.
 */
        public record VerifyOtpRequest(
                        @Email @NotBlank String email,
                        @NotBlank String otp,
                        @NotBlank String fullName,
                        @NotBlank String username,
                        @NotBlank String password,
                        UserRole role,
                        String walletAddress) {
        }

/**
 * Immutable data carrier for resend verification OTP request.
 */
        public record ResendOtpRequest(
                        @Email @NotBlank String email) {
        }
}
