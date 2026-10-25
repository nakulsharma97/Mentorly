package com.mentorly.auth;

import com.mentorly.config.ClientIpResolver;
import com.mentorly.user.UserRole;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Locale;

/**
 * Encapsulates oauth2 login success.
 */
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

        private static final Logger LOG = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);

        /**
         * Cookie written by the signup form before the OAuth redirect; carries
         * the role the user chose ("MENTOR" / "LEARNER") across the round trip.
         * Read once, then cleared on the same response.
         */
        static final String SIGNUP_ROLE_COOKIE = "oauth_signup_role";

        private final ObjectProvider<AuthService> authServiceProvider;
        private final AuthCookieService authCookieService;
        private final ClientIpResolver clientIpResolver;

        @Value("${app.oauth2.redirect-url}")
        private String frontendRedirectUrl;

        @Override
        public void onAuthenticationSuccess(HttpServletRequest request,
                        HttpServletResponse response,
                        Authentication authentication) throws IOException, ServletException {
                OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
                OAuth2User oauthUser = token.getPrincipal();
                AuthService authService = authServiceProvider.getObject();

                // Read the signup intent BEFORE clearing it. Parsed strictly:
                // only MENTOR / LEARNER (case-insensitive) are accepted, so a
                // forged/stale/ADMIN cookie can never mint a privileged account.
                UserRole requestedRole = readRequestedRole(request);
                clearSignupRoleCookie(response);

                String clientIp = clientIpResolver.resolve(request);
                try {
                        AuthDtos.AuthResponse authResponse = authService.loginWithOAuth(
                                        token.getAuthorizedClientRegistrationId(),
                                        oauthUser.getAttributes(),
                                        clientIp,
                                        requestedRole);

                        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
                        response.sendRedirect(frontendRedirectUrl);
                } catch (RuntimeException ex) {
                        // Rate-limited, disabled account, or invalid attributes:
                        // never leak an error page — redirect back to the SPA
                        // with the error param so it can show a friendly message.
                        // The requested role is the only cookie data ever logged.
                        LOG.warn("OAuth login rejected for provider={}, ip={}, requestedRole={}: {}",
                                        token.getAuthorizedClientRegistrationId(), clientIp, requestedRole,
                                        ex.getMessage());
                        String redirectUrl = UriComponentsBuilder
                                        .fromUriString(frontendRedirectUrl)
                                        .queryParam("error", "oauth_login_failed")
                                        .build()
                                        .toUriString();
                        response.sendRedirect(redirectUrl);
                }
        }

        /**
         * Parses the {@code oauth_signup_role} cookie into a role the new-user
         * branch may honor. Returns null when absent or anything other than
         * MENTOR / LEARNER — malformed input is never propagated.
         */
        private UserRole readRequestedRole(HttpServletRequest request) {
                Cookie[] cookies = request.getCookies();
                if (cookies == null) {
                        return null;
                }
                for (Cookie cookie : cookies) {
                        if (!SIGNUP_ROLE_COOKIE.equals(cookie.getName())) {
                                continue;
                        }
                        String raw = cookie.getValue();
                        if (raw == null || raw.isBlank()) {
                                return null;
                        }
                        try {
                                UserRole parsed = UserRole.valueOf(raw.trim().toUpperCase(Locale.ROOT));
                                return parsed == UserRole.MENTOR || parsed == UserRole.LEARNER
                                                ? parsed
                                                : null;
                        } catch (IllegalArgumentException ex) {
                                return null;
                        }
                }
                return null;
        }

        /** One-shot cookie: the intent must not survive the callback. */
        private void clearSignupRoleCookie(HttpServletResponse response) {
                Cookie cleared = new Cookie(SIGNUP_ROLE_COOKIE, "");
                cleared.setPath("/");
                cleared.setMaxAge(0);
                response.addCookie(cleared);
        }
}
