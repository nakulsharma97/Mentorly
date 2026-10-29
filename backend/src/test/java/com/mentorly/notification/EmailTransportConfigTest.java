package com.mentorly.notification;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.mail.javamail.JavaMailSender;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailTransportConfigTest {

    private final EmailTransportConfig config = new EmailTransportConfig();

    /** An ObjectProvider with nothing registered — mimics the "no mail sender" case. */
    private ObjectProvider<JavaMailSender> noMailSender() {
        return new DefaultListableBeanFactory().getBeanProvider(JavaMailSender.class);
    }

    private EmailTransport select(String provider, boolean enabled, String apiKey) {
        return config.emailTransport(noMailSender(), provider, enabled,
                "no-reply@mentorly.app", "Mentorly", apiKey, "https://api.brevo.com");
    }

    @Test
    void defaultProviderIsSmtp() {
        assertInstanceOf(SmtpEmailTransport.class, select("SMTP", true, ""));
    }

    @Test
    void providerNameIsCaseInsensitive() {
        assertInstanceOf(BrevoApiEmailTransport.class, select("brevo_api", true, "key"));
        assertInstanceOf(SmtpEmailTransport.class, select("smtp", true, ""));
    }

    @Test
    void brevoProviderBuildsTheApiTransport() {
        assertInstanceOf(BrevoApiEmailTransport.class, select("BREVO_API", true, "key"));
    }

    @Test
    void brevoProviderWithBlankKeyStillStartsSoTheWarningCanBeActedOn() {
        // Delivery fails at send time with the generic message; startup must not
        // crash a deployment that is only missing one environment variable.
        assertInstanceOf(BrevoApiEmailTransport.class, select("BREVO_API", true, "  "));
    }

    @Test
    void unknownProviderFailsFastWithAnActionableMessage() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> select("SENDGRID", true, ""));

        assertTrue(ex.getMessage().contains("app.email.provider"), ex.getMessage());
        assertTrue(ex.getMessage().contains("SMTP"), ex.getMessage());
        assertTrue(ex.getMessage().contains("BREVO_API"), ex.getMessage());
    }
}
