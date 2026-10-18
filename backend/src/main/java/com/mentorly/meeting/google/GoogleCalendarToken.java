package com.mentorly.meeting.google;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Persisted Google Calendar OAuth token for the single organisation-wide
 * Google account ({@link GoogleOAuthTokenManager#ACCOUNT_KEY}).
 *
 * <p>Storing the refresh token in MySQL keeps Google Meet link generation
 * working across restarts and redeploys — the previous {@code FileDataStore}
 * lived on ephemeral container storage. Tokens are never logged.
 */
@Getter
@Setter
@Entity
@Table(name = "google_calendar_tokens")
public class GoogleCalendarToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Logical owner of the token; currently always {@code "admin"}. */
    @Column(name = "account_key", nullable = false, unique = true, length = 100)
    private String accountKey;

    /** Long-lived refresh token returned by Google (offline access). */
    @Column(name = "refresh_token", nullable = false, columnDefinition = "TEXT")
    private String refreshToken;

    /** Current short-lived access token, refreshed on demand. */
    @Column(name = "access_token", columnDefinition = "TEXT")
    private String accessToken;

    /** Absolute expiry of {@link #accessToken} (UTC). */
    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
