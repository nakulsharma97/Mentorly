package com.skillswap.auth;

import com.skillswap.user.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {

        public record SignupRequest(
                        @Email String email,
                        @NotBlank String password,
                        @NotBlank String fullName,
                        UserRole role,
                        String walletAddress,
                        String referralCode) {
        }

        public record LoginRequest(
                        @Email String email,
                        @NotBlank String password) {
        }

        public record AuthResponse(String token, String refreshToken, String email, String role) {
        }

        public record AuthSessionResponse(String email, String role, String token, String refreshToken) {
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
