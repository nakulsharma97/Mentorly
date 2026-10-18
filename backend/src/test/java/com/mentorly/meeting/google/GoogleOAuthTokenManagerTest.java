package com.mentorly.meeting.google;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.auth.oauth2.TokenResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GoogleOAuthTokenManager}: DB-backed credential loading,
 * refresh persistence and the "not connected" behaviour.
 */
@ExtendWith(MockitoExtension.class)
class GoogleOAuthTokenManagerTest {

    @Mock
    private GoogleCalendarTokenRepository tokenRepository;

    private GoogleCalendarProperties properties;

    @BeforeEach
    void setUp() {
        properties = new GoogleCalendarProperties();
        properties.setClientId("test-client-id.apps.googleusercontent.com");
        properties.setClientSecret("test-client-secret");
        properties.setRedirectUri("https://mentorly.example/api/v1/admin/google-calendar/callback");
    }

    private TestableTokenManager manager() {
        return new TestableTokenManager(properties, tokenRepository);
    }

    /* ── hasValidToken / empty state ─────────────────────────────────── */

    @Test
    void hasValidTokenIsFalseWhenNoTokenRowExists() {
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.empty());

        assertThat(manager().hasValidToken()).isFalse();
    }

    @Test
    void hasValidTokenIsFalseWhenIntegrationIsNotConfigured() {
        properties.setClientId("");
        properties.setClientSecret("");

        assertThat(manager().hasValidToken()).isFalse();
        verify(tokenRepository, never()).findByAccountKey(anyString());
    }

    @Test
    void getAccessTokenFailsCleanlyWhenNotConnected() {
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> manager().getAccessToken())
                .isInstanceOf(IOException.class)
                .hasMessageContaining("not connected");
    }

    /* ── Loading from the database ───────────────────────────────────── */

    @Test
    void loadsStoredCredentialFromDatabaseAndReusesAccessToken() throws IOException {
        GoogleCalendarToken row = storedToken("stored-refresh-token", "stored-access-token",
                OffsetDateTime.now(ZoneOffset.UTC).plusHours(1));
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.of(row));

        TestableTokenManager manager = manager();

        assertThat(manager.hasValidToken()).isTrue();
        assertThat(manager.getAccessToken()).isEqualTo("stored-access-token");
    }

    @Test
    void refreshesExpiredAccessTokenAndPersistsTheNewOne() throws IOException {
        GoogleCalendarToken row = storedToken("stored-refresh-token", "stale-access-token",
                OffsetDateTime.now(ZoneOffset.UTC).minusHours(1));
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.of(row));
        when(tokenRepository.save(any(GoogleCalendarToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AtomicReference<String> accessToken = new AtomicReference<>("stale-access-token");
        AtomicLong expiresAt = new AtomicLong(System.currentTimeMillis() - 60_000L);
        Credential credential = mock(Credential.class);
        when(credential.getRefreshToken()).thenReturn("stored-refresh-token");
        when(credential.getAccessToken()).thenAnswer(invocation -> accessToken.get());
        when(credential.getExpirationTimeMilliseconds()).thenAnswer(invocation -> expiresAt.get());
        when(credential.refreshToken()).thenAnswer(invocation -> {
            accessToken.set("refreshed-access-token");
            expiresAt.set(System.currentTimeMillis() + 3_600_000L);
            return true;
        });

        TestableTokenManager manager = manager();
        manager.useCredential(credential);

        assertThat(manager.getAccessToken()).isEqualTo("refreshed-access-token");

        ArgumentCaptor<GoogleCalendarToken> saved = ArgumentCaptor.forClass(GoogleCalendarToken.class);
        verify(tokenRepository).save(saved.capture());
        assertThat(saved.getValue().getAccountKey()).isEqualTo(GoogleOAuthTokenManager.ACCOUNT_KEY);
        assertThat(saved.getValue().getRefreshToken()).isEqualTo("stored-refresh-token");
        assertThat(saved.getValue().getAccessToken()).isEqualTo("refreshed-access-token");
        assertThat(saved.getValue().getExpiresAt())
                .isAfter(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(30));
    }

    @Test
    void hasValidTokenIsFalseWhenRefreshIsRejected() throws IOException {
        GoogleCalendarToken row = storedToken("revoked-refresh-token", "stale-access-token",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(1));
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.of(row));

        Credential credential = mock(Credential.class);
        when(credential.getRefreshToken()).thenReturn("revoked-refresh-token");
        when(credential.getExpirationTimeMilliseconds())
                .thenReturn(System.currentTimeMillis() - 60_000L);
        when(credential.refreshToken()).thenReturn(false);

        TestableTokenManager manager = manager();
        manager.useCredential(credential);

        assertThat(manager.hasValidToken()).isFalse();
        verify(tokenRepository, never()).save(any(GoogleCalendarToken.class));
    }

    /* ── authenticate() ──────────────────────────────────────────────── */

    @Test
    void authenticateStoresRefreshTokenForAdminAccount() throws IOException {
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.empty());
        when(tokenRepository.save(any(GoogleCalendarToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TestableTokenManager manager = manager();
        manager.useTokenResponse(new TokenResponse()
                .setAccessToken("fresh-access-token")
                .setRefreshToken("fresh-refresh-token")
                .setExpiresInSeconds(3600L));

        assertThat(manager.authenticate("authorization-code")).isTrue();

        ArgumentCaptor<GoogleCalendarToken> saved = ArgumentCaptor.forClass(GoogleCalendarToken.class);
        verify(tokenRepository).save(saved.capture());
        GoogleCalendarToken row = saved.getValue();
        assertThat(row.getAccountKey()).isEqualTo(GoogleOAuthTokenManager.ACCOUNT_KEY);
        assertThat(row.getRefreshToken()).isEqualTo("fresh-refresh-token");
        assertThat(row.getAccessToken()).isEqualTo("fresh-access-token");
        assertThat(row.getExpiresAt()).isAfter(OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(50));
    }

    @Test
    void authenticateUpdatesExistingRowInsteadOfCreatingADuplicate() throws IOException {
        GoogleCalendarToken existing = storedToken("old-refresh-token", "old-access-token",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(2));
        existing.setId(7L);
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.of(existing));
        when(tokenRepository.save(any(GoogleCalendarToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TestableTokenManager manager = manager();
        manager.useTokenResponse(new TokenResponse()
                .setAccessToken("new-access-token")
                .setRefreshToken("new-refresh-token")
                .setExpiresInSeconds(3600L));

        assertThat(manager.authenticate("authorization-code")).isTrue();

        ArgumentCaptor<GoogleCalendarToken> saved = ArgumentCaptor.forClass(GoogleCalendarToken.class);
        verify(tokenRepository).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo(7L);
        assertThat(saved.getValue().getRefreshToken()).isEqualTo("new-refresh-token");
        assertThat(saved.getValue().getAccessToken()).isEqualTo("new-access-token");
    }

    @Test
    void authenticateReturnsFalseWhenTheCodeExchangeFails() throws IOException {
        TestableTokenManager manager = manager();
        manager.failExchangeWith(new IOException("invalid_grant"));

        assertThat(manager.authenticate("expired-code")).isFalse();
        verify(tokenRepository, never()).save(any(GoogleCalendarToken.class));
    }

    @Test
    void authenticateReturnsFalseWhenTheRefreshTokenCannotBeStored() throws IOException {
        when(tokenRepository.findByAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY))
                .thenReturn(Optional.empty());
        when(tokenRepository.save(any(GoogleCalendarToken.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("database unavailable"));

        TestableTokenManager manager = manager();
        manager.useTokenResponse(new TokenResponse()
                .setAccessToken("fresh-access-token")
                .setRefreshToken("fresh-refresh-token")
                .setExpiresInSeconds(3600L));

        assertThat(manager.authenticate("authorization-code")).isFalse();
        verify(tokenRepository).save(any(GoogleCalendarToken.class));
    }

    @Test
    void authenticateReturnsFalseWhenIntegrationIsNotConfigured() {
        properties.setRedirectUri("");

        assertThat(manager().authenticate("authorization-code")).isFalse();
        verify(tokenRepository, never()).findByAccountKey(anyString());
    }

    /* ── Authorization URL ───────────────────────────────────────────── */

    @Test
    void authorizationUrlRequestsOfflineAccessWithConsentAndState() {
        String url = manager().buildAuthorizationUrl("state-value");

        assertThat(url)
                .startsWith("https://accounts.google.com/o/oauth2/auth")
                .contains("access_type=offline")
                .contains("prompt=consent")
                .contains("state=state-value")
                .contains("redirect_uri=")
                .contains("scope=https://www.googleapis.com/auth/calendar");
    }

    /* ── Fixtures ────────────────────────────────────────────────────── */

    private GoogleCalendarToken storedToken(String refreshToken, String accessToken,
            OffsetDateTime expiresAt) {
        GoogleCalendarToken row = new GoogleCalendarToken();
        row.setAccountKey(GoogleOAuthTokenManager.ACCOUNT_KEY);
        row.setRefreshToken(refreshToken);
        row.setAccessToken(accessToken);
        row.setExpiresAt(expiresAt);
        return row;
    }

    /**
     * Test double that replaces the two network-facing seams of the manager.
     */
    private static final class TestableTokenManager extends GoogleOAuthTokenManager {

        private Credential credentialOverride;
        private TokenResponse tokenResponse;
        private IOException exchangeFailure;

        TestableTokenManager(GoogleCalendarProperties properties, GoogleCalendarTokenRepository repository) {
            super(properties, repository);
        }

        void useCredential(Credential credential) {
            this.credentialOverride = credential;
        }

        void useTokenResponse(TokenResponse response) {
            this.tokenResponse = response;
        }

        void failExchangeWith(IOException failure) {
            this.exchangeFailure = failure;
        }

        @Override
        protected Credential buildCredential() {
            return credentialOverride != null ? credentialOverride : super.buildCredential();
        }

        @Override
        protected TokenResponse exchangeAuthorizationCode(String authorizationCode) throws IOException {
            if (exchangeFailure != null) {
                throw exchangeFailure;
            }
            return tokenResponse;
        }
    }
}
