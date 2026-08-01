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

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private static final String HEALTH_PATH = "/api/v1/health";

    private final JwtService jwtService;
    private final AccessTokenDenylistRepository accessTokenDenylistRepository;
    private final UserDetailsService userDetailsService;
    private final UserRepository userRepository;
    private final PlatformTransactionManager transactionManager;

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
                        log.warn("Failed to update lastActiveAt for {}", userEmail, ex);
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
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }

        String cookieToken = resolveTokenFromCookie(request);
        if (cookieToken != null && !cookieToken.isBlank()) {
            return cookieToken;
        }

        return null;
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
