package com.skillswap.config;

import com.skillswap.auth.OAuth2LoginFailureHandler;
import com.skillswap.auth.OAuth2LoginSuccessHandler;
import com.skillswap.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Encapsulates security.
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final EndpointRateLimitFilter endpointRateLimitFilter;
        private final RequestTraceFilter requestTraceFilter;
        private final MaintenanceModeFilter maintenanceModeFilter;
        private final UserDetailsService userDetailsService;
        private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
        private final OAuth2LoginFailureHandler oAuth2LoginFailureHandler;
        private final ObjectMapper objectMapper;

        @Value("${app.cors.allowed-origins:http://localhost:5174,http://127.0.0.1:5174}")
        private String allowedOrigins;

        @Value("${app.cors.allow-credentials:true}")
        private boolean allowCredentials;

        // Suppressed because Spring Security 6.x deprecated HttpSecurity APIs
        // are required until the project migrates to the component-based security DSL.
        @SuppressWarnings({"deprecation", "removal"})
        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                return http
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                // CSRF is disabled because this is a JWT-based SPA where authentication
                                // is handled via the Authorization: Bearer header (never auto-sent by the
                                // browser on cross-origin requests). The JWT Bearer token is the
                                // authoritative auth mechanism, making classic CSRF token protection
                                // redundant.
                                //
                                // Residual risk: the access_token cookie fallback (used for WebSocket
                                // handshakes / OAuth flows) could theoretically be replayed by a
                                // cross-site request. JwtAuthenticationFilter mitigates this by only
                                // accepting the cookie when the request is same-origin (Origin header
                                // matches the configured CORS allowlist, or no Origin is present, e.g.
                                // WebSocket upgrades / non-browser clients).
                                .csrf(csrf -> csrf.disable())
                                .headers(headers -> headers
                                                // CSP uses 'unsafe-inline' because this is a client-side
                                                // rendered React SPA where inline scripts/styles are
                                                // injected by Vite at build time. A nonce-based approach
                                                // would require server-side rendering (SSR) which is
                                                // not part of the current architecture.
                                                .contentSecurityPolicy(csp -> csp.policyDirectives(
                                                                "default-src 'self'; script-src 'self' 'unsafe-inline';"
                                                                        + " style-src 'self' 'unsafe-inline';"
                                                                        + " img-src 'self' data: https:"))
                                                .frameOptions(frame -> frame.deny())
                                                // X-XSS-Protection is omitted because modern browsers
                                                // have deprecated this header. CSP configured above is
                                                // the effective XSS defense.
                                                .contentTypeOptions(content -> { })
                                                .httpStrictTransportSecurity(hsts -> hsts
                                                                .includeSubDomains(true)
                                                                .preload(true)
                                                                .maxAgeInSeconds(31536000)))
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers("/api/v1/availability/my-slots",
                                                                "/api/v1/availability/my-slots/**")
                                                .hasAnyRole("MENTOR", "TEACHER", "ADMIN")
                                                // ── Admin routes ──
                                                // Booking approval endpoints live under /api/v1/admin/bookings
                                                // but are intentionally reachable by MENTORs (mentor approves
                                                // learner bookings for their own sessions) as well as admins.
                                                .requestMatchers("/api/v1/admin/bookings/**")
                                                .hasAnyRole("MENTOR", "ADMIN")
                                                .requestMatchers("/api/v1/admin/**")
                                                .hasRole("ADMIN")
                                                // Mentor verification moderation endpoints live outside
                                                // /api/v1/admin/**
                                                // (mentor-facing /request and /my stay role-agnostic) but the
                                                // moderation queue + decision endpoints are admin-only. This
                                                // filter-chain rule is defense-in-depth on top of the controller
                                                // level ensureAdmin() checks.
                                                .requestMatchers("/api/v1/verification/mentor/requests/**")
                                                .hasRole("ADMIN")                                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login",
                                                                "/api/v1/auth/signup",
                                                                "/api/v1/auth/refresh",
                                                                "/api/v1/auth/logout")
                                                                .permitAll()
                                                                // Payment gateway callbacks are unauthenticated by design — the
                                                                // controller verifies the gateway HMAC signature itself (see
                                                                // PaymentController.handleWebhook) before processing any event.
                                                                .requestMatchers(HttpMethod.POST, "/api/v1/payments/webhook/**")
                                                                .permitAll()
                                                .requestMatchers("/api/v1/health", "/actuator/health",
                                                                "/actuator/prometheus", "/ws/**")
                                                .permitAll()
                                                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                                                .requestMatchers("/api/v1/public/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/v1/users/mentors",
                                                                "/api/v1/users/mentors/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/v1/reviews/mentor/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/v1/mentor/certifications/**")
                                                .permitAll()

                                                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**",
                                                                "/swagger-resources/**")
                                                .permitAll()
                                                .anyRequest().authenticated())
                                .exceptionHandling(ex -> ex
                                                .defaultAuthenticationEntryPointFor(
                                                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                                                new AntPathRequestMatcher("/api/**"))
                                                .defaultAccessDeniedHandlerFor(restAccessDeniedHandler(),
                                                                new AntPathRequestMatcher("/api/**")))
                                .oauth2Login(oauth2 -> oauth2
                                                .successHandler(oAuth2LoginSuccessHandler)
                                                .failureHandler(oAuth2LoginFailureHandler))
                                .authenticationProvider(authenticationProvider())
                                .addFilterBefore(requestTraceFilter, SecurityContextHolderFilter.class)
                                .addFilterBefore(endpointRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterAfter(maintenanceModeFilter, JwtAuthenticationFilter.class)
                                .build();
        }

        @Bean
        public DaoAuthenticationProvider authenticationProvider() {
                DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
                provider.setUserDetailsService(userDetailsService);
                provider.setPasswordEncoder(passwordEncoder());
                return provider;
        }

        @Bean
        public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
                return config.getAuthenticationManager();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder(10);
        }

        /**
         * Returns a JSON {@code ApiResponse} with HTTP 403 when an authenticated
         * user lacks the role required for a protected resource. Matches the
         * structured error format used by {@code GlobalExceptionHandler} so API
         * clients (e.g. the React SPA) can render consistent error messages.
         */
        private AccessDeniedHandler restAccessDeniedHandler() {
                return (request, response, accessDeniedException) -> {
                        response.setStatus(HttpStatus.FORBIDDEN.value());
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        response.setCharacterEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
                        Map<String, Object> error = new LinkedHashMap<>();
                        error.put("code", "FORBIDDEN");
                        error.put("error", "Access denied: you do not have permission to access this resource");
                        error.put("message", "Access denied: you do not have permission to access this resource");
                        error.put("retryable", false);
                        error.put("traceId", org.slf4j.MDC.get("traceId") == null
                                ? "na" : org.slf4j.MDC.get("traceId"));
                        objectMapper.writeValue(response.getOutputStream(),
                                        new ApiResponse<>("Request failed", error));
                };
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();
                List<String> parsedOrigins = java.util.Arrays.stream(allowedOrigins.split(","))
                                .map(String::trim)
                                .filter(origin -> !origin.isBlank())
                                .filter(origin -> !"*".equals(origin))
                                .collect(Collectors.toList());
                config.setAllowedOrigins(parsedOrigins);
                config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                // Explicit header allowlist (never "*") — keeps the preflight
                // surface minimal while still covering every header the SPA and
                // gateway callbacks send. `Idempotency-Key` and `X-Webhook-Signature`
                // are app-specific headers used by booking creation and webhooks.
                config.setAllowedHeaders(List.of(
                                "Authorization",
                                "Content-Type",
                                "Accept",
                                "Origin",
                                "X-Requested-With",
                                "Idempotency-Key",
                                "X-Webhook-Signature",
                                "X-CSRF-TOKEN"));
                config.setAllowCredentials(allowCredentials);
                config.setExposedHeaders(List.of("X-Total-Count", "X-Page-Number", "X-Page-Size"));
                config.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", config);
                return source;
        }
}
