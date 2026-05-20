package com.skillswap.auth;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.skillswap.auth.AuthDtos.*;

@Tag(name = "Authentication", description = "User signup, login, and token refresh operations")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ApiResponse<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return new ApiResponse<>("Signup successful", authService.signup(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return new ApiResponse<>("Login successful", authService.login(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return new ApiResponse<>("Token refreshed", authService.refreshToken(request));
    }

    @PostMapping("/logout-all")
    public ApiResponse<LogoutAllResponse> logoutAll(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Logged out from all sessions", authService.logoutAllSessions(currentUser));
    }
}
