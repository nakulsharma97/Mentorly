package com.skillswap.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

        private final ObjectProvider<AuthService> authServiceProvider;
        private final AuthCookieService authCookieService;

        @Value("${app.oauth2.redirect-url}")
        private String frontendRedirectUrl;

        @Override
        public void onAuthenticationSuccess(HttpServletRequest request,
                        HttpServletResponse response,
                        Authentication authentication) throws IOException, ServletException {
                OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
                OAuth2User oauthUser = token.getPrincipal();
                AuthService authService = authServiceProvider.getObject();

                AuthDtos.AuthResponse authResponse = authService.loginWithOAuth(
                                token.getAuthorizedClientRegistrationId(),
                                oauthUser.getAttributes());

                authCookieService.writeAuthCookies(response, authResponse.token(), authResponse.refreshToken());

                response.sendRedirect(frontendRedirectUrl);
        }
}
