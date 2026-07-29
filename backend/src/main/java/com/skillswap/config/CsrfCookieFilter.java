package com.skillswap.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * A no-op CSRF cookie filter.
 *
 * CSRF protection is disabled at the security-config level because this is a
 * JWT‑based SPA; see {@link SecurityConfig#securityFilterChain}.
 * This class exists only so that {@code @MockitoBean} declarations in
 * integration tests can resolve. The filter itself is never wired into the
 * security chain.
 */
@Component
public class CsrfCookieFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        // CSRF is disabled — this is a no‑op placeholder for test mocking.
        filterChain.doFilter(request, response);
    }
}
