package com.mentorly.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * Decides whether an endpoint that must deliver a code (signup OTP, password
 * reset) may answer "sent".
 *
 * <p>With email disabled, dev/local/test keep the historic log-only behaviour so
 * nobody has to run an SMTP server to work locally. Every other profile (prod,
 * staging, anything else) refuses with HTTP 503: telling the user a code was
 * sent when no transport exists is the bug that leaves them waiting forever
 * for an email that will never arrive.
 */
@Component
public class EmailDeliveryGuard {

    private static final Set<String> NON_PRODUCTION_PROFILES = Set.of("dev", "development", "local", "test");

    private final boolean emailEnabled;
    private final Environment environment;

    public EmailDeliveryGuard(@Value("${app.email.enabled:false}") boolean emailEnabled,
            Environment environment) {
        this.emailEnabled = emailEnabled;
        this.environment = environment;
    }

    /**
     * @throws EmailNotConfiguredException when email is disabled in a
     *                                     production-like environment.
     */
    public void requireConfigured() {
        if (emailEnabled || !isProductionLike()) {
            return;
        }
        throw new EmailNotConfiguredException();
    }

    /**
     * True when at least one active profile is not a development profile. With
     * no active profile (unit tests, plain {@code mvn spring-boot:run}) the app
     * is treated as development.
     */
    boolean isProductionLike() {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            return false;
        }
        for (String profile : activeProfiles) {
            if (!NON_PRODUCTION_PROFILES.contains(profile.trim().toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }
}
