package com.mentorly.auth;

import com.mentorly.config.ClientIpResolver;
import jakarta.servlet.ServletException;
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

/**
 * Encapsulates oauth2 login success.
 */
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

        private static final Logger LOG = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);

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

                String clientIp = clientIpResolver.resolve(request);
                try {
                        AuthDtos.AuthResponse authResponse = authService.loginWithOAuth(
                                        token.getAuthorizedClientRegistrationId(),
                                        oauthUser.getAttributes(),
                                        clientIp);

                        authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());
                        response.sendRedirect(frontendRedirectUrl);
                } catch (RuntimeException ex) {
                        // Rate-limited, disabled account, or invalid attributes:
                        // never leak an error page — redirect back to the SPA
                        // with the error param so it can show a friendly message.
                        LOG.warn("OAuth login rejected for provider={}, ip={}: {}",
                                        token.getAuthorizedClientRegistrationId(), clientIp, ex.getMessage());
                        String redirectUrl = UriComponentsBuilder
                                        .fromUriString(frontendRedirectUrl)
                                        .queryParam("error", "oauth_login_failed")
                                        .build()
                                        .toUriString();
                        response.sendRedirect(redirectUrl);
                }
        }
}
