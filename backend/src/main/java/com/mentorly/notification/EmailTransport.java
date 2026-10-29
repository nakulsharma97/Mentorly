package com.mentorly.notification;

/**
 * Delivers a single plain-text email.
 *
 * <p>Two implementations exist because the hosting environment decides which
 * one can work: {@link SmtpEmailTransport} speaks SMTP, while
 * {@link BrevoApiEmailTransport} talks to Brevo over HTTPS. Render's free web
 * services block outbound SMTP ports (25/465/587), so only the HTTPS transport
 * can deliver mail there.
 *
 * <p>Implementations must throw {@link RuntimeException} with the generic
 * message {@code Unable to send email. Please try again.} when delivery fails —
 * callers decide whether the failure is fatal (OTP must be reported to the
 * caller) or merely logged (booking notifications).
 */
public interface EmailTransport {

    String GENERIC_FAILURE_MESSAGE = "Unable to send email. Please try again.";

    void send(String to, String subject, String body);
}
