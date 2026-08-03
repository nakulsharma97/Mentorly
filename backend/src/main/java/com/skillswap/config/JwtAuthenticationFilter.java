package com.skillswap.config;

import com.skillswap.auth.AccessTokenDenylistRepository;
import com.skillswap.auth.AuthCookieService;
import com.skillswap.auth.JwtService;
import com.skillswap.user.UserRepository;
import jakarta.servlet.FilterChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Encapsulates jwt authentication filter.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private static final String HEALTH_PATH = "/api/v1/health";

    private final JwtService jwtService;
    private final AccessTokenDenylistRepository accessTokenDenylistRepository;
    private final UserDetailsService userDetailsService;
    private final UserRepository userRepository;
    private final PlatformTransactionManager transactionManager;

    /**
     * Comma-separated list of origins allowed to authenticate via the
     * access_token cookie. Used to reject cross-site cookie replay (CSRF on the
     * cookie fallback path): a request carrying an Origin header that is not in
     * this list is treated as unauthenticated even if the cookie is present.
     * Kept in sync with {@code app.cors.allowed-origins} (same default).
     */
    @org.springframework.beans.factory.annotation.Value(
            "${app.cors.allowed-origins:http://localhost:5174,http://127.0.0.1:5174}")
    private String allowedOrigins;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return HEALTH_PATH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String jwt = resolveAccessToken(request);
        if (jwt == null || jwt.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (!jwtService.isAccessToken(jwt)) {
                filterChain.doFilter(request, response);
                return;
            }

            String jwtId = jwtService.extractJwtId(jwt);
            if (accessTokenDenylistRepository.existsByJtiAndExpiresAtAfter(jwtId, OffsetDateTime.now(ZoneOffset.UTC))) {
                filterChain.doFilter(request, response);
                return;
            }

            String userEmail = jwtService.extractUsername(jwt);

            if (userEmail != null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    // Lightweight last-active timestamp update.
                    // Uses a direct UPDATE query instead of loading + saving the
                    // full User entity, which avoids SELECT overhead, entity
                    // hydration, and cascading flushes on every request.
                    // Servlet filters run outside Spring's @Transactional proxy,
                    // so a bare @Modifying query would fail with a
                    // TransactionRequiredException on every request. Open the
                    // transaction explicitly with TransactionTemplate instead.
                    try {
                        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                                userRepository.updateLastActiveAt(userEmail, OffsetDateTime.now()));
                    } catch (Exception ex) {
                        // A failed activity ping must never break authentication,
                        // but it should be visible in the logs (not silently swallowed).
                        LOG.warn("Failed to update lastActiveAt for {}", userEmail, ex);
                    }
                }
            }
        } catch (RuntimeException ex) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private String resolveAccessToken(HttpServletRequest request) {
        // The Authorization Bearer header takes priority over cookies because
        // it carries the most recently issued token (e.g. after an account switch).
        // Cookies are checked as a fallback for WebSocket connections or OAuth
        // flows that may not include an explicit Bearer header.
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")
                && !authHeader.substring(7).trim().isBlank()) {
            return authHeader.substring(7).trim();
        }

        String cookieToken = resolveTokenFromCookie(request);
        if (cookieToken != null && !cookieToken.isBlank()
                && isCookieOriginTrusted(request)) {
            return cookieToken;
        }

        return null;
    }

    /**
     * CSRF mitigation for the cookie fallback path. The access_token cookie is
     * only honored when the request is same-origin: either no Origin header is
     * present (WebSocket upgrades, non-browser clients, same-origin navigations)
     * or the Origin matches the configured CORS allowlist. A cross-site request
     * (attacker page triggering a form/multipart upload) carries a foreign
     * Origin, so the cookie is ignored and the request stays unauthenticated.
     */
    private boolean isCookieOriginTrusted(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank()) {
            return true;
        }
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            return false;
        }
        String normalized = origin.trim().toLowerCase(java.util.Locale.ROOT);
        for (String entry : allowedOrigins.split(",")) {
            String candidate = entry.trim().toLowerCase(java.util.Locale.ROOT);
            if (!candidate.isBlank() && candidate.equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private String resolveTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookies.length == 0) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (AuthCookieService.ACCESS_TOKEN_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
