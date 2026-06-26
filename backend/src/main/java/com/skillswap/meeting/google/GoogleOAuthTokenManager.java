package com.skillswap.meeting.google;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.auth.oauth2.TokenResponse;
import com.google.api.client.auth.oauth2.TokenResponseException;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.StringReader;
import java.security.GeneralSecurityException;
import java.util.Collections;

/**
 * Manages OAuth 2.0 tokens for Google Calendar API.
 * Handles token refresh and storage securely.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoogleOAuthTokenManager {

    private final GoogleCalendarProperties properties;
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String TOKENS_DIRECTORY_PATH = "tokens";

    private Credential credential;
    private long tokenExpiryTime = 0;

    /**
     * Authenticates with Google Calendar API using OAuth 2.0.
     * Should be called once by the admin user to authorize the application.
     *
     * @param authorizationCode the authorization code from Google OAuth callback
     * @return true if authentication is successful
     */
    public boolean authenticate(String authorizationCode) {
        try {
            GoogleAuthorizationCodeFlow flow = createFlow();
            TokenResponse tokenResponse = flow.newTokenRequest(authorizationCode)
                    .setRedirectUri(properties.getRedirectUri())
                    .execute();
            credential = flow.createAndStoreCredential(tokenResponse, "admin");
            updateTokenExpiry();
            log.info("Google Calendar OAuth authentication successful");
            return true;
        } catch (IOException | GeneralSecurityException e) {
            log.error("Failed to authenticate with Google Calendar", e);
            return false;
        }
    }

    /**
     * Retrieves a valid access token, refreshing if necessary.
     *
     * @return the access token
     * @throws IOException if token retrieval fails
     */
    public String getAccessToken() throws IOException {
        ensureCredentialLoaded();

        if (isTokenExpired()) {
            refreshToken();
        }

        if (credential == null || credential.getAccessToken() == null) {
            throw new IOException("No valid Google Calendar access token available");
        }

        return credential.getAccessToken();
    }

    /**
     * Checks if a valid token is currently available.
     *
     * @return true if a valid token exists
     */
    public boolean hasValidToken() {
        try {
            ensureCredentialLoaded();
            if (credential == null) {
                return false;
            }
            if (isTokenExpired()) {
                refreshToken();
            }
            return credential.getAccessToken() != null;
        } catch (Exception e) {
            log.warn("Token validation failed", e);
            return false;
        }
    }

    /**
     * Refreshes the OAuth token if it's about to expire.
     *
     * @throws IOException if refresh fails
     */
    public void refreshToken() throws IOException {
        if (credential == null) {
            throw new IOException("No credential loaded to refresh");
        }

        try {
            if (credential.refreshToken()) {
                updateTokenExpiry();
                log.info("Google Calendar OAuth token refreshed successfully");
            }
        } catch (TokenResponseException e) {
            log.error("Failed to refresh Google Calendar token", e);
            throw new IOException("Token refresh failed", e);
        }
    }

    /**
     * Stores the credential for later use.
     *
     * @param credential the credential to store
     */
    public void storeCredential(Credential credential) {
        this.credential = credential;
        updateTokenExpiry();
    }

    // Helper methods

    private GoogleAuthorizationCodeFlow createFlow() throws GeneralSecurityException, IOException {
        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(
                JSON_FACTORY,
                new StringReader(buildClientSecretsJson()));

        return new GoogleAuthorizationCodeFlow.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                JSON_FACTORY,
                clientSecrets,
                Collections.singletonList(properties.getScopes()))
                .setDataStoreFactory(new FileDataStoreFactory(new java.io.File(TOKENS_DIRECTORY_PATH)))
                .setAccessType("offline")
                .build();
    }

    private String buildClientSecretsJson() {
        return String.format(
                "{\"installed\":{\"client_id\":\"%s\",\"client_secret\":\"%s\",\"redirect_uris\":[\"%s\"]}}",
                properties.getClientId(),
                properties.getClientSecret(),
                properties.getRedirectUri());
    }

    private void ensureCredentialLoaded() {
        // In a production system, you would load the credential from secure storage
        // For now, this is a placeholder
    }

    private boolean isTokenExpired() {
        return System.currentTimeMillis() > tokenExpiryTime;
    }

    private void updateTokenExpiry() {
        if (credential != null && credential.getExpiresInSeconds() != null) {
            tokenExpiryTime = System.currentTimeMillis() +
                    (credential.getExpiresInSeconds() * 1000) -
                    (5 * 60 * 1000); // Refresh 5 minutes before expiry
        }
    }
}
