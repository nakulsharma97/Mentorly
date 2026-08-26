package com.mentorly.config;

import com.mentorly.admin.AdminSetting;
import com.mentorly.admin.AdminSettingRepository;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/**
 * When maintenance mode is enabled in the database ({@code admin_settings}
 * table, key {@code maintenance_mode} = {@code "true"}), all requests from
 * non-admin users are rejected with HTTP 503 (Service Unavailable).
 * <p>
 * Public endpoints (login, signup, health, etc.) and admin API paths are
 * always allowed so that administrators can access settings to disable
 * maintenance mode.
 * <p>
 * The setting is cached for up to 30 seconds to avoid querying the
 * database on every single request.
 */
/**
 * Encapsulates maintenance mode filter.
 */
@Slf4j
@Component
public class MaintenanceModeFilter extends OncePerRequestFilter {

    /** Public paths that should always be accessible. */
    private static final List<String> PUBLIC_PREFIXES = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/signup",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/api/v1/health",
            "/actuator/",
            "/oauth2/",
            "/login/oauth2/",
            "/swagger-ui/",
            "/v3/api-docs/",
            "/ws/",
            "/api/v1/chat/");

    /** Admin API prefix — always allowed so admins can disable maintenance mode. */
    private static final String ADMIN_API_PREFIX = "/api/v1/admin/";

    private static final long CACHE_TTL_MS = 30_000L;

    private final AdminSettingRepository adminSettingRepository;

    private volatile Boolean cachedEnabled;
    private volatile long cacheExpiresAt;

    public MaintenanceModeFilter(AdminSettingRepository adminSettingRepository) {
        this.adminSettingRepository = adminSettingRepository;
    }

    /**
     * Drops the cached maintenance-mode flag so the next request re-reads the
     * database. Called by the admin settings endpoints right after a toggle so
     * the change applies immediately instead of waiting out the 30s TTL.
     */
    public void invalidateCache() {
        cachedEnabled = null;
        cacheExpiresAt = 0L;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        // Skip check for public endpoints
        String path = request.getRequestURI();
        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check maintenance mode (with caching)
        if (!isMaintenanceModeEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        // Maintenance mode is ON — check if user is admin
        if (isAdminPath(path)) {
            // Admin API — always allow so admins can toggle maintenance mode off
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof User user
                && user.getRole() == UserRole.ADMIN) {
            // Admin users can access everything during maintenance
            filterChain.doFilter(request, response);
            return;
        }

        // Block the request — return 503 Service Unavailable
        log.info("maintenance_mode_active blocking={} {} from={}",
                request.getMethod(), path, request.getRemoteAddr());

        response.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
        response.setContentType("application/json");
        response.setHeader("Retry-After", "3600");
        response.getWriter().write("{\"message\":\"Platform is under maintenance\",\"data\":{\"error\":\""
                + "The platform is currently in maintenance mode."
                + " Only administrators can access the system."
                + " Please try again later.\",\"code\":\"MAINTENANCE_MODE\"}}");
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private boolean isAdminPath(String path) {
        return path.startsWith(ADMIN_API_PREFIX);
    }

    private boolean isMaintenanceModeEnabled() {
        long now = Instant.now().toEpochMilli();
        if (now < cacheExpiresAt && cachedEnabled != null) {
            return cachedEnabled;
        }

        // Cache miss or expired — query the database
        try {
            boolean enabled = adminSettingRepository
                    .findBySettingKey("maintenance_mode")
                    .map(AdminSetting::getSettingValue)
                    .map("true"::equalsIgnoreCase)
                    .orElse(false);

            cachedEnabled = enabled;
            cacheExpiresAt = now + CACHE_TTL_MS;
            return enabled;
        } catch (Exception e) {
            log.warn("Failed to read maintenance_mode setting, assuming disabled", e);
            cachedEnabled = false;
            cacheExpiresAt = now + CACHE_TTL_MS;
            return false;
        }
    }
}
