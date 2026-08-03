package com.skillswap.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;

/**
 * Service implementing auth cookie business logic.
 */
@Service
public class AuthCookieService {

    public static final String ACCESS_TOKEN_COOKIE = "access_token";
    public static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    @Value("${app.auth.cookies.secure:false}")
    private boolean secureCookies;

    /**
     * SameSite attribute for auth cookies. Defaults to {@code Lax}: same-site
     * requests (the normal API flow, incl. dev localhost:5174 -> localhost:8080
     * and prod same-origin via the nginx proxy) still carry the cookie, but
     * cross-site POSTs cannot — closing the CSRF vector on the cookie path.
     * Override to {@code None} only for genuinely cross-site deployments, and
     * only together with {@code app.auth.cookies.secure=true}.
     */
    @Value("${app.auth.cookies.same-site:Lax}")
    private String sameSite;

    @Value("${app.jwt.expiration-ms}")
    private long accessTokenMaxAgeMs;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshTokenMaxAgeMs;

    public void writeAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        // Cookie `maxAge` is specified in seconds; convert from configured milliseconds
        long accessSeconds = Math.max(0, accessTokenMaxAgeMs / 1000);
        long refreshSeconds = Math.max(0, refreshTokenMaxAgeMs / 1000);
        addCookie(response, ACCESS_TOKEN_COOKIE, accessToken, Duration.ofSeconds(accessSeconds));
        addCookie(response, REFRESH_TOKEN_COOKIE, refreshToken, Duration.ofSeconds(refreshSeconds));
    }

    public void clearAuthCookies(HttpServletResponse response) {
        clearCookie(response, ACCESS_TOKEN_COOKIE);
        clearCookie(response, REFRESH_TOKEN_COOKIE);
    }

    private void addCookie(HttpServletResponse response, String name, String value, Duration maxAge) {
        ResponseCookie cookie = buildAuthCookie(name, value, maxAge);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearCookie(HttpServletResponse response, String name) {
        ResponseCookie cookie = buildAuthCookie(name, "", Duration.ZERO);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private ResponseCookie buildAuthCookie(String name, String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .path("/")
                .maxAge(maxAge);

        // SameSite=Lax by default (see field javadoc): same-site requests still
        // carry the cookie, cross-site POSTs cannot — closing the CSRF hole for
        // cookie-based auth (e.g. multipart uploads from a foreign origin).
        // SameSite=None would let any cross-site form post replay the cookie.
        builder.secure(secureCookies).sameSite(sameSite);

        return builder.build();
    }
}
