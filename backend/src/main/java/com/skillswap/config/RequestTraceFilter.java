package com.skillswap.config;

import com.skillswap.monitoring.RequestStatsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class RequestTraceFilter extends OncePerRequestFilter {

    private static final String TRACE_ID = "traceId";
    private static final String TRACE_HEADER = "X-Trace-Id";

    private final RequestStatsService requestStatsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String traceId = request.getHeader(TRACE_HEADER);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }

        long startNs = System.nanoTime();
        MDC.put(TRACE_ID, traceId);
        response.setHeader(TRACE_HEADER, traceId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - startNs) / 1_000_000;
            requestStatsService.record(request.getRequestURI(), durationMs, response.getStatus());
            log.info("request_completed method={} path={} status={} durationMs={} traceId={}",
                    request.getMethod(), request.getRequestURI(), response.getStatus(), durationMs, traceId);
            MDC.remove(TRACE_ID);
        }
    }
}
