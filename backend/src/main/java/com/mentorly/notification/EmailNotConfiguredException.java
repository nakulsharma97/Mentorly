package com.mentorly.notification;

/**
 * Thrown when an endpoint must deliver a code but email delivery is switched
 * off in a production-like environment. Mapped to HTTP 503 by
 * GlobalExceptionHandler so the client shows a real error instead of a
 * fabricated "code sent" success.
 */
public class EmailNotConfiguredException extends RuntimeException {

    public static final String MESSAGE = "Email service is not configured.";

    public EmailNotConfiguredException() {
        super(MESSAGE);
    }
}
