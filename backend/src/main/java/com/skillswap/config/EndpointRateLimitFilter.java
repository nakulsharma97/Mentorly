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

@Slf4j
@Component
public class EndpointRateLimitFilter extends OncePerRequestFilter {

    private static final long ONE_MINUTE_MS = 60_000L;

    @Value("${app.rate-limit.auth.max-per-minute:25}")
    private int authMaxPerMinute;

    @Value("${app.rate-limit.payment.max-per-minute:40}")
    private int paymentMaxPerMinute;

    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        int limit = resolveLimit(path);
        if (limit <= 0 || "OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = buildRateLimitKey(path, request);
        long now = Instant.now().toEpochMilli();

        WindowCounter counter = counters.computeIfAbsent(key, ignored -> new WindowCounter(now));
        synchronized (counter) {
            if (now - counter.windowStartMs >= ONE_MINUTE_MS) {
                counter.windowStartMs = now;
                counter.requests.set(0);
            }

            int current = counter.requests.incrementAndGet();
            if (current > limit) {
                log.warn("rate_limit_exceeded path={} ip={} current={} limit={}", path, request.getRemoteAddr(),
                        current, limit);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"message\":\"Too many requests\",\"data\":{\"error\":\"Rate limit exceeded. Please retry in a minute.\"}}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private int resolveLimit(String path) {
        if (path.startsWith("/api/v1/auth/")) {
            return authMaxPerMinute;
        }
        if (path.startsWith("/api/v1/payments")) {
            return paymentMaxPerMinute;
        }
        return -1;
    }

    private String buildRateLimitKey(String path, HttpServletRequest request) {
        String client = request.getHeader("X-Forwarded-For");
        if (client == null || client.isBlank()) {
            client = request.getRemoteAddr();
        }
        return path + "::" + client;
    }

    private static final class WindowCounter {
        private long windowStartMs;
        private final AtomicInteger requests = new AtomicInteger(0);

        private WindowCounter(long windowStartMs) {
            this.windowStartMs = windowStartMs;
        }
    }
}
