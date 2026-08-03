package com.skillswap.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Encapsulates endpoint rate limit filter.
 */
@Slf4j
@Component
public class EndpointRateLimitFilter extends OncePerRequestFilter {

    private static final long ONE_MINUTE_MS = 60_000L;

    private final ClientIpResolver clientIpResolver;

    public EndpointRateLimitFilter(ClientIpResolver clientIpResolver) {
        this.clientIpResolver = clientIpResolver;
    }

    @Value("${app.rate-limit.auth.max-per-minute:25}")
    private int authMaxPerMinute;

    @Value("${app.rate-limit.payment.max-per-minute:40}")
    private int paymentMaxPerMinute;

    @Value("${app.rate-limit.api-write.max-per-minute:120}")
    private int apiWriteMaxPerMinute;

    @Value("${app.rate-limit.search.max-per-minute:60}")
    private int searchMaxPerMinute;

    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        int limit = resolveLimit(path, method);
        if (limit <= 0 || "OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = buildRateLimitKey(path, request);
        long now = Instant.now().toEpochMilli();

        WindowCounter counter = counters.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStartMs >= ONE_MINUTE_MS) {
                WindowCounter fresh = new WindowCounter(now);
                fresh.requests.incrementAndGet();
                return fresh;
            }
            existing.requests.incrementAndGet();
            return existing;
        });

        if (counter.requests.get() > limit) {
            log.warn("rate_limit_exceeded path={} ip={} current={} limit={}", path, request.getRemoteAddr(),
                    counter.requests.get(), limit);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"message\":\"Too many requests\","
                            + "\"data\":{\"error\":\"Rate limit exceeded. Please retry in a minute.\"}}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private int resolveLimit(String path, String method) {
        if (path.startsWith("/api/v1/auth/")) {
            return authMaxPerMinute;
        }
        if (path.startsWith("/api/v1/payments")) {
            return paymentMaxPerMinute;
        }
        // Public/costly search endpoints (unauthenticated-ish reads) are
        // per-IP limited to prevent scraping and heavy index scans.
        if (path.startsWith("/api/v1/search/")) {
            return searchMaxPerMinute;
        }
        boolean isWriteMethod = "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
        if (isWriteMethod && path.startsWith("/api/v1/")) {
            return apiWriteMaxPerMinute;
        }
        return -1;
    }

    private String buildRateLimitKey(String path, HttpServletRequest request) {
        // Resolve the client IP through the trusted-proxy-aware resolver so a
        // spoofed X-Forwarded-For header can never be used to bypass the
        // per-IP rate limit.
        return path + "::" + clientIpResolver.resolve(request);
    }

    private static final class WindowCounter {
        private long windowStartMs;
        private final AtomicInteger requests = new AtomicInteger(0);

        private WindowCounter(long windowStartMs) {
            this.windowStartMs = windowStartMs;
        }
    }
}
