package com.skillswap.auth;

import com.skillswap.user.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

        public record SignupRequest(
                        @Email @NotBlank String email,
                        @NotBlank @Size(min = 6, message = "Password must be at least 6 characters") String password,
                        @NotBlank String fullName,
                        @NotBlank String username,
                        UserRole role,
                        String walletAddress,
                        String referralCode) {
        }

        public record LoginRequest(
                        @NotBlank String email,
                        @NotBlank String password) {
        }

        public record AuthResponse(String token, String refreshToken, String email, String role, String username) {
        }

        public record AuthSessionResponse(String email, String role, String token, String refreshToken, String username) {
        }

        public record RefreshTokenRequest(
                        @NotBlank String refreshToken) {
        }

        public record LogoutAllResponse(int revokedSessions) {
        }

        public record LogoutResponse(int revokedSessions) {
        }

        public record ForgotPasswordRequest(
                        @Email String email) {
        }

        public record ResetPasswordRequest(
                        @NotBlank String token,
                        @NotBlank String newPassword) {
        }
}
