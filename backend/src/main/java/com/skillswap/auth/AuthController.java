package com.skillswap.auth;

import com.skillswap.common.ApiResponse;
import com.skillswap.config.ClientIpResolver;
import com.skillswap.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.skillswap.auth.AuthDtos.*;

/**
 * REST controller exposing auth endpoints.
 */
@Tag(name = "Authentication", description = "User signup, login, and token refresh operations")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthCookieService authCookieService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/signup")
    public ApiResponse<AuthSessionResponse> signup(@Valid @RequestBody SignupRequest request,
            HttpServletResponse response,
            HttpServletRequest httpRequest) {
        String clientIp = clientIpResolver.resolve(httpRequest);
        AuthResponse authResponse = authService.signup(request, clientIp);
        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
        return new ApiResponse<>("Signup successful", sanitize(authResponse));
    }

    @PostMapping("/login")
    public ApiResponse<AuthSessionResponse> login(@Valid @RequestBody LoginRequest request,
            HttpServletResponse response,
            HttpServletRequest httpRequest) {
        String clientIp = clientIpResolver.resolve(httpRequest);
        AuthResponse authResponse = authService.login(request, clientIp);
        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
        return new ApiResponse<>("Login successful", sanitize(authResponse));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthSessionResponse> refresh(
            @CookieValue(value = AuthCookieService.REFRESH_TOKEN_COOKIE, required = false) String refreshTokenCookie,
            HttpServletResponse response) {
        // SECURITY: the refresh token is accepted ONLY from the httpOnly
        // refresh_token cookie. Tokens sent in the request body are never
        // honored — body tokens could be exfiltrated by XSS and replayed, and
        // accepting them would undermine the cookie-only session model.
        // A missing cookie falls through to authService, which rejects with
        // "Refresh token is required".
        AuthResponse authResponse = authService.refreshToken(refreshTokenCookie);
        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
        return new ApiResponse<>("Token refreshed", sanitize(authResponse));
    }

    @PostMapping("/logout")
    public ApiResponse<LogoutResponse> logout(
            @CookieValue(value = AuthCookieService.ACCESS_TOKEN_COOKIE, required = false) String accessTokenCookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            HttpServletRequest request,
            HttpServletResponse response) {
        String accessToken = resolveAccessToken(accessTokenCookie, authorizationHeader);
        LogoutResponse logoutResponse = accessToken == null || accessToken.isBlank()
                ? new LogoutResponse(0)
                : authService.logoutCurrentSession(accessToken);
        authCookieService.clearAuthCookies(response);
        // Invalidate the HTTP session to clear the stale SecurityContext so the
        // next request does not accidentally authenticate as the previous user
        // via SecurityContextHolderFilter restoring from the session.
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return new ApiResponse<>("Logged out", logoutResponse);
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        String clientIp = clientIpResolver.resolve(httpRequest);
        authService.forgotPassword(request, clientIp);
        return new ApiResponse<>("If this email is registered, a reset link has been sent.", null);
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return new ApiResponse<>("Password has been reset successfully.", null);
    }

    @PostMapping("/logout-all")
    public ApiResponse<LogoutAllResponse> logoutAll(@AuthenticationPrincipal User currentUser,
            HttpServletResponse response) {
        authCookieService.clearAuthCookies(response);
        return new ApiResponse<>("Logged out from all sessions", authService.logoutAllSessions(currentUser));
    }

    private AuthSessionResponse sanitize(AuthResponse authResponse) {
        return new AuthSessionResponse(authResponse.email(), authResponse.role(), authResponse.token(),
                authResponse.refreshToken(), authResponse.username(), authResponse.profileCompleted());
    }

    private String resolveAccessToken(String accessTokenCookie, String authorizationHeader) {
        if (accessTokenCookie != null && !accessTokenCookie.isBlank()) {
            return accessTokenCookie;
        }
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            return authorizationHeader.substring(7).trim();
        }
        return null;
    }
}
