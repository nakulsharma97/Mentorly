package com.mentorly.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Locale;

/**
 * Chooses the email transport from {@code app.email.provider} (APP_EMAIL_PROVIDER).
 *
 * <p>SMTP is the default so existing deployments keep working unchanged. Set
 * {@code BREVO_API} on hosts that block outbound SMTP (Render free instances).
 * An unrecognised value fails fast at startup instead of silently falling back
 * to a transport that cannot work.
 */
@Slf4j
@Configuration
public class EmailTransportConfig {

    public static final String PROVIDER_SMTP = "SMTP";
    public static final String PROVIDER_BREVO_API = "BREVO_API";

    @Bean
    public EmailTransport emailTransport(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.email.provider:SMTP}") String provider,
            @Value("${app.email.enabled:false}") boolean emailEnabled,
            @Value("${app.email.from:no-reply@mentorly.app}") String fromAddress,
            @Value("${app.email.from-name:Mentorly}") String fromName,
            @Value("${app.email.brevo.api-key:}") String brevoApiKey,
            @Value("${app.email.brevo.base-url:https://api.brevo.com}") String brevoBaseUrl) {

        String normalized = provider == null ? "" : provider.trim().toUpperCase(Locale.ROOT);

        if (PROVIDER_BREVO_API.equals(normalized)) {
            String key = brevoApiKey == null ? "" : brevoApiKey.trim();
            if (emailEnabled && key.isEmpty()) {
                log.warn("app.email.provider=BREVO_API but BREVO_API_KEY is blank — verification and "
                        + "password-reset emails will fail until it is set.");
            }
            log.info("Email transport: Brevo API ({})", brevoBaseUrl);
            return new BrevoApiEmailTransport(key, fromAddress, fromName, brevoBaseUrl);
        }

        if (PROVIDER_SMTP.equals(normalized)) {
            log.info("Email transport: SMTP (enabled={})", emailEnabled);
            return new SmtpEmailTransport(mailSenderProvider, fromAddress);
        }

        throw new IllegalStateException("Unsupported app.email.provider='" + provider
                + "'. Supported values: " + PROVIDER_SMTP + ", " + PROVIDER_BREVO_API + ".");
    }
}
