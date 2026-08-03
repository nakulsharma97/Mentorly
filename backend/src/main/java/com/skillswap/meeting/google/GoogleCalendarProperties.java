package com.skillswap.meeting.google;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for Google Calendar API.
 * Read from application.properties or environment variables.
 */
/**
 * Encapsulates google calendar properties.
 */
@Data
@Component
@ConfigurationProperties(prefix = "google.calendar")
public class GoogleCalendarProperties {

    private String clientId;

    private String clientSecret;

    private String redirectUri;

    private String applicationCredentialsPath;

    private String adminEmail;

    private String scopes = "https://www.googleapis.com/auth/calendar";

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank()
                && redirectUri != null && !redirectUri.isBlank();
    }
}
