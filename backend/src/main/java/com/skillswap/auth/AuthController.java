package com.skillswap.auth;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.skillswap.auth.AuthDtos.*;

@Tag(name = "Authentication", description = "User signup, login, and token refresh operations")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthCookieService authCookieService;

    @PostMapping("/signup")
    public ApiResponse<AuthSessionResponse> signup(@Valid @RequestBody SignupRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.signup(request);
        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
        return new ApiResponse<>("Signup successful", sanitize(authResponse));
    }

    @PostMapping("/login")
    public ApiResponse<AuthSessionResponse> login(@Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
        return new ApiResponse<>("Login successful", sanitize(authResponse));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthSessionResponse> refresh(
            @CookieValue(value = AuthCookieService.REFRESH_TOKEN_COOKIE, required = false) String refreshTokenCookie,
            @RequestBody(required = false) RefreshTokenRequest request,
            HttpServletResponse response) {
        String refreshToken = refreshTokenCookie;
        if ((refreshToken == null || refreshToken.isBlank()) && request != null) {
            refreshToken = request.refreshToken();
        }
        AuthResponse authResponse = authService.refreshToken(refreshToken);
        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
        return new ApiResponse<>("Token refreshed", sanitize(authResponse));
    }

    @PostMapping("/logout")
    public ApiResponse<LogoutResponse> logout(
            @CookieValue(value = AuthCookieService.ACCESS_TOKEN_COOKIE, required = false) String accessToken,
            HttpServletResponse response) {
        LogoutResponse logoutResponse = accessToken == null || accessToken.isBlank()
                ? new LogoutResponse(0)
                : authService.logoutCurrentSession(accessToken);
        authCookieService.clearAuthCookies(response);
        return new ApiResponse<>("Logged out", logoutResponse);
    }

    @PostMapping("/logout-all")
    public ApiResponse<LogoutAllResponse> logoutAll(@AuthenticationPrincipal User currentUser,
            HttpServletResponse response) {
        authCookieService.clearAuthCookies(response);
        return new ApiResponse<>("Logged out from all sessions", authService.logoutAllSessions(currentUser));
    }

    private AuthSessionResponse sanitize(AuthResponse authResponse) {
        return new AuthSessionResponse(authResponse.email(), authResponse.role());
    }
}
