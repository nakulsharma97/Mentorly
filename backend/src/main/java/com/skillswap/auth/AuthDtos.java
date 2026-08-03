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
                        @NotBlank String username,
                        UserRole role,
                        String walletAddress,
                        String referralCode) {
        }

/**
 * Immutable data carrier for login request.
 */
        public record LoginRequest(
                        @NotBlank String email,
                        @NotBlank String password) {
        }

/**
 * Immutable data carrier for auth response.
 */
        public record AuthResponse(String token, String refreshToken, String email, String role, String username) {
        }

/**
 * Immutable data carrier for auth session response.
 */
        public record AuthSessionResponse(String email, String role, String token,
                String refreshToken, String username) {
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
}
