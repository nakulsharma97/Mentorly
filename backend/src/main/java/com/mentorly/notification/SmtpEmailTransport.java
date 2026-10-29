package com.mentorly.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * SMTP transport — the original email path (JavaMailSender + SimpleMailMessage).
 *
 * <p>Behaviour is unchanged from before the transport abstraction: a missing
 * JavaMailSender logs and returns, while a {@link MailException} is logged and
 * rethrown with the generic message so callers can decide how to react.
 */
@Slf4j
public class SmtpEmailTransport implements EmailTransport {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;

    public SmtpEmailTransport(ObjectProvider<JavaMailSender> mailSenderProvider, String fromAddress) {
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
    }

    @Override
    public void send(String to, String subject, String body) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Email enabled but JavaMailSender is not configured. Skipping email for {}", to);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to send email to {}: {}", to, ex.getMessage());
            throw new RuntimeException(GENERIC_FAILURE_MESSAGE);
        }
    }
}
