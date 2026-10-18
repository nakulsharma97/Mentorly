package com.mentorly.meeting.google;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.ClientParametersAuthentication;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.auth.oauth2.TokenResponse;
import com.google.api.client.auth.oauth2.TokenResponseException;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.auth.oauth2.GoogleOAuthConstants;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.StringReader;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Manages the OAuth 2.0 credential used by the Google Calendar / Google Meet
 * integration.
 *
 * <p>Tokens are stored in the {@code google_calendar_tokens} table (see Flyway
 * {@code V79}) instead of a local {@code FileDataStore}, so the connection
 * survives application restarts and redeploys. The in-memory {@link Credential}
 * is only a cache: it is rebuilt from the database on first use after a restart.
 *
 * <p>Secrets and tokens are never logged.
 */
@Slf4j
@Component
public class GoogleOAuthTokenManager {

    /** Logical owner of the token row: Mentorly has one organisation-wide account. */
    static final String ACCOUNT_KEY = "admin";

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String DEFAULT_SCOPE = "https://www.googleapis.com/auth/calendar";

    /** Refresh this long before the access token actually expires. */
    private static final long EXPIRY_SKEW_MILLIS = Duration.ofMinutes(5).toMillis();

    private final GoogleCalendarProperties properties;
    private final GoogleCalendarTokenRepository tokenRepository;

    private HttpTransport transport;
    private Credential credential;

    public GoogleOAuthTokenManager(
            GoogleCalendarProperties properties,
            GoogleCalendarTokenRepository tokenRepository) {
        this.properties = properties;
        this.tokenRepository = tokenRepository;
    }

    /**
     * Builds the Google consent URL for the admin.
     *
     * <p>Requests offline access with {@code prompt=consent} so Google always
     * returns a refresh token (without consent, a repeat authorization can omit
     * it and the integration would silently break after the first hour).
     *
     * @param state opaque CSRF value validated on the callback
     * @return the authorization URL
     */
    public String buildAuthorizationUrl(String state) {
        try {
            return createFlow().newAuthorizationUrl()
                    .setRedirectUri(properties.getRedirectUri())
                    .setState(state)
                    .set("prompt", "consent")
                    .build();
        } catch (GeneralSecurityException | IOException e) {
            // Deliberately no exception detail: it can include the redirect URI.
            throw new IllegalStateException("Could not build the Google Calendar authorization URL");
        }
    }

    /**
     * Exchanges an authorization code for tokens and persists the refresh token.
     *
     * @param authorizationCode the {@code code} query parameter from Google
     * @return {@code true} when the token was stored successfully
     */
    public synchronized boolean authenticate(String authorizationCode) {
        if (!properties.isConfigured() || authorizationCode == null || authorizationCode.isBlank()) {
            log.warn("Google Calendar OAuth callback ignored: integration not configured or code missing");
            return false;
        }

        try {
            TokenResponse tokenResponse = exchangeAuthorizationCode(authorizationCode);
            Credential authorized = createCredential(tokenResponse);
            credential = authorized;
            // Only report success when the refresh token actually reached MySQL:
            // an in-memory-only credential would silently disappear on restart.
            boolean persisted = persistCredential(authorized);
            if (persisted) {
                log.info("Google Calendar OAuth authentication successful");
            } else {
                log.error("Google Calendar OAuth succeeded but the refresh token could not be persisted");
            }
            return persisted;
        } catch (IOException | GeneralSecurityException | RuntimeException e) {
            credential = null;
            log.error("Google Calendar OAuth authentication failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Retrieves a valid access token, refreshing it when it is close to expiry.
     *
     * @return the access token
     * @throws IOException when the integration is not connected or the token cannot be refreshed
     */
    public synchronized String getAccessToken() throws IOException {
        Credential current = loadCredential();
        if (current == null) {
            throw new IOException("Google Calendar is not connected");
        }
        if (isTokenExpired(current) && !refreshCredential(current)) {
            throw new IOException("Google Calendar token refresh failed");
        }

        String accessToken = current.getAccessToken();
        if (accessToken == null || accessToken.isBlank()) {
            throw new IOException("No valid Google Calendar access token available");
        }
        return accessToken;
    }

    /**
     * Checks whether a usable Google Calendar credential exists.
     *
     * <p>Never throws: a missing row (integration never connected), a revoked
     * refresh token, or a transient Google error all simply report {@code false}.
     *
     * @return {@code true} when an access token is available
     */
    public synchronized boolean hasValidToken() {
        if (!properties.isConfigured()) {
            return false;
        }
        try {
            Credential current = loadCredential();
            if (current == null) {
                return false;
            }
            if (isTokenExpired(current) && !refreshCredential(current)) {
                return false;
            }
            String accessToken = current.getAccessToken();
            return accessToken != null && !accessToken.isBlank();
        } catch (Exception e) {
            log.warn("Google Calendar token validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Forces a credential refresh (used by callers that received a 401).
     *
     * @throws IOException when no credential exists or the refresh is rejected
     */
    public synchronized void refreshToken() throws IOException {
        Credential current = loadCredential();
        if (current == null) {
            throw new IOException("No Google Calendar credential to refresh");
        }
        if (!refreshCredential(current)) {
            throw new IOException("Google Calendar token refresh failed");
        }
    }

    // ── Internals ──────────────────────────────────────────────────────────

    /**
     * Loads the credential from MySQL on first use and caches it in memory.
     *
     * @return the credential, or {@code null} when no token row exists
     */
    private Credential loadCredential() {
        if (credential != null) {
            return credential;
        }

        Optional<GoogleCalendarToken> stored = tokenRepository.findByAccountKey(ACCOUNT_KEY);
        if (stored.isEmpty()) {
            return null;
        }

        GoogleCalendarToken row = stored.get();
        Credential restored = buildCredential();
        restored.setRefreshToken(row.getRefreshToken());
        restored.setAccessToken(row.getAccessToken());
        restored.setExpiresInSeconds(secondsUntil(row.getExpiresAt()));

        credential = restored;
        return credential;
    }

    /**
     * Refreshes the access token and persists the new value.
     *
     * @return {@code true} when Google issued a new access token
     */
    protected boolean refreshCredential(Credential current) throws IOException {
        if (current.getRefreshToken() == null || current.getRefreshToken().isBlank()) {
            return false;
        }
        try {
            boolean refreshed = current.refreshToken();
            if (refreshed) {
                persistCredential(current);
                log.info("Google Calendar OAuth token refreshed successfully");
            }
            return refreshed;
        } catch (TokenResponseException e) {
            // Status only — the response body can echo the client credentials.
            log.warn("Google Calendar token refresh rejected by Google (HTTP {})", e.getStatusCode());
            return false;
        }
    }

    /**
     * Upserts the refresh/access token for {@link #ACCOUNT_KEY}.
     *
     * @return {@code true} when the row was written
     */
    private boolean persistCredential(Credential current) {
        if (current == null
                || current.getRefreshToken() == null
                || current.getRefreshToken().isBlank()) {
            // Never overwrite a stored refresh token with nothing.
            return false;
        }

        try {
            GoogleCalendarToken row = tokenRepository.findByAccountKey(ACCOUNT_KEY)
                    .orElseGet(GoogleCalendarToken::new);
            row.setAccountKey(ACCOUNT_KEY);
            row.setRefreshToken(current.getRefreshToken());
            row.setAccessToken(current.getAccessToken());
            Long expiresAtMillis = current.getExpirationTimeMilliseconds();
            row.setExpiresAt(expiresAtMillis == null
                    ? null
                    : OffsetDateTime.ofInstant(Instant.ofEpochMilli(expiresAtMillis), ZoneOffset.UTC));
            tokenRepository.save(row);
            return true;
        } catch (RuntimeException e) {
            // Only the exception type: a JPA/Hibernate message can echo the bound
            // row values, i.e. the tokens themselves.
            log.warn("Could not persist the Google Calendar token ({})", e.getClass().getSimpleName());
            return false;
        }
    }

    /**
     * Exchanges the authorization code at Google's token endpoint.
     * Extracted so tests can stub the network call.
     */
    protected TokenResponse exchangeAuthorizationCode(String authorizationCode)
            throws IOException, GeneralSecurityException {
        return createFlow().newTokenRequest(authorizationCode)
                .setRedirectUri(properties.getRedirectUri())
                .execute();
    }

    private Credential createCredential(TokenResponse tokenResponse) throws IOException {
        Credential created = buildCredential();
        created.setFromTokenResponse(tokenResponse);
        return created;
    }

    /**
     * Builds an empty credential wired to Google's token endpoint. Extracted so
     * tests can substitute a credential without going through the network.
     */
    protected Credential buildCredential() {
        return new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(getTransport())
                .setJsonFactory(JSON_FACTORY)
                .setClientAuthentication(new ClientParametersAuthentication(
                        properties.getClientId(), properties.getClientSecret()))
                .setTokenServerEncodedUrl(GoogleOAuthConstants.TOKEN_SERVER_URL)
                .build();
    }

    private GoogleAuthorizationCodeFlow createFlow() throws GeneralSecurityException, IOException {
        return new GoogleAuthorizationCodeFlow.Builder(
                getTransport(),
                JSON_FACTORY,
                GoogleClientSecrets.load(JSON_FACTORY, new StringReader(buildClientSecretsJson())),
                scopes())
                .setAccessType("offline")
                .build();
    }

    /**
     * The OAuth client is registered as a <em>Web application</em>, so the
     * client-secrets document must use the {@code "web"} section (the
     * {@code "installed"} variant is for desktop/CLI clients).
     */
    private String buildClientSecretsJson() {
        return String.format(
                "{\"web\":{\"client_id\":\"%s\",\"client_secret\":\"%s\",\"redirect_uris\":[\"%s\"]}}",
                properties.getClientId(),
                properties.getClientSecret(),
                properties.getRedirectUri());
    }

    private List<String> scopes() {
        String configured = properties.getScopes();
        if (configured == null || configured.isBlank()) {
            return List.of(DEFAULT_SCOPE);
        }
        return Arrays.stream(configured.split(","))
                .map(String::trim)
                .filter(scope -> !scope.isEmpty())
                .toList();
    }

    private HttpTransport getTransport() {
        if (transport == null) {
            try {
                transport = GoogleNetHttpTransport.newTrustedTransport();
            } catch (GeneralSecurityException | IOException e) {
                throw new IllegalStateException("Could not initialize the Google HTTP transport");
            }
        }
        return transport;
    }

    private boolean isTokenExpired(Credential current) {
        Long expiresAt = current.getExpirationTimeMilliseconds();
        if (expiresAt == null) {
            return current.getAccessToken() == null;
        }
        return System.currentTimeMillis() >= expiresAt - EXPIRY_SKEW_MILLIS;
    }

    private Long secondsUntil(OffsetDateTime expiresAt) {
        if (expiresAt == null) {
            return null;
        }
        return Duration.between(Instant.now(), expiresAt.toInstant()).getSeconds();
    }
}
