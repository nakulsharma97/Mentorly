package com.skillswap.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates critical environment variables at application startup.
 * Fails fast with a clear message if required configuration is missing,
 * preventing silent misconfiguration in production.
 */
@Component
public class EnvironmentConfigValidator implements InitializingBean {

    private static final Logger LOG = LoggerFactory.getLogger(EnvironmentConfigValidator.class);

    private final Environment env;

    public EnvironmentConfigValidator(Environment env) {
        this.env = env;
    }

    @Override
    public void afterPropertiesSet() {
        String[] activeProfiles = env.getActiveProfiles();
        boolean isProduction = false;
        for (String profile : activeProfiles) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                isProduction = true;
                break;
            }
        }

        List<String> errors = new ArrayList<>();

        // ── Critical: no defaults → app will fail without these ──
        checkRequired(env, "JWT_SECRET", "app.jwt.secret", errors);
        checkRequired(env, "SPRING_DATASOURCE_PASSWORD", "spring.datasource.password", errors);

        // ── Critical in production profile only ──
        if (isProduction) {
            checkRequired(env, "CORS_ALLOWED_ORIGINS", "app.cors.allowed-origins", errors);
            checkRequired(env, "OAUTH2_REDIRECT_URL", "app.oauth2.redirect-url", errors);
        }

        // ── Important: has defaults but should be explicitly set in production ──
        if (isProduction) {
            warnIfDefault(env, "SPRING_DATASOURCE_URL", "spring.datasource.url",
                    "jdbc:mysql://localhost:3306/skill?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC");
            warnIfDefault(env, "SPRING_DATASOURCE_USERNAME", "spring.datasource.username", "root");
            warnIfDefault(env, "APP_EMAIL_ENABLED", "app.email.enabled", "false");
            warnIfDefault(env, "SENTRY_DSN", "sentry.dsn", "");
        }

        if (!errors.isEmpty()) {
            String message = String.format(
                    "❌ Application startup blocked: %d required environment variable(s) are missing.%n%n"
                    + "Please set the following variables before starting the application:%n",
                    errors.size());
            for (String error : errors) {
                message += "   • " + error + "\n";
            }
            message += "\nSee backend/.env.example for a complete list of configuration options.";
            LOG.error(message);
            throw new IllegalStateException(message);
        }

        LOG.info("✅ Environment configuration validated successfully (profile: {})",
                activeProfiles.length > 0 ? String.join(", ", activeProfiles) : "default");
    }

    private static void checkRequired(Environment env, String envVar, String propertyKey, List<String> errors) {
        String value = env.getProperty(propertyKey);
        if (value == null || value.isBlank()) {
            errors.add(String.format("%s (${%s})", envVar, propertyKey));
        } else if (isPlaceholder(value)) {
            errors.add(String.format(
                    "%s (${%s}) — resolved to unresolved placeholder: '%s'",
                    envVar, propertyKey, value));
        }
    }

    private static void warnIfDefault(Environment env, String envVar, String propertyKey, String defaultValue) {
        String value = env.getProperty(propertyKey);
        if (value != null && value.equals(defaultValue)) {
            LOG.warn("⚠️  {} is using its default value '{}'. Set {} explicitly in production for security.",
                    envVar, defaultValue, envVar);
        }
    }

    private static boolean isPlaceholder(String value) {
        return value != null && value.startsWith("${") && value.endsWith("}");
    }
}
