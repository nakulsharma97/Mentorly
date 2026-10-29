package com.mentorly.notification;

import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

/**
 * Service implementing email notification business logic.
 *
 * <p>Delivery itself is delegated to the {@link EmailTransport} selected by
 * {@link EmailTransportConfig} (SMTP or Brevo's HTTPS API), so this class only
 * owns the templates and the enabled/disabled policy.
 */
@Slf4j
@Service
public class EmailNotificationService {

    private static final DateTimeFormatter EMAIL_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm XXX");

    private final EmailTransport emailTransport;
    private final boolean emailEnabled;

    public EmailNotificationService(EmailTransport emailTransport,
            @Value("${app.email.enabled:false}") boolean emailEnabled) {
        this.emailTransport = emailTransport;
        this.emailEnabled = emailEnabled;
    }

    @Async("emailTaskExecutor")
    public void sendBookingCreated(User mentor, User learner, SkillSession session) {
        sendNotificationEmail(
                mentor,
                "Mentorly: New booking request",
                EmailTemplates.bookingCreatedToMentor(
                        nameOf(mentor),
                        nameOf(learner),
                        titleOf(session),
                        startOf(session)));
    }

    @Async("emailTaskExecutor")
    public void sendBookingAccepted(User learner, User mentor, SkillSession session) {
        sendNotificationEmail(
                learner,
                "Mentorly: Booking accepted",
                EmailTemplates.bookingAcceptedToLearner(
                        nameOf(learner),
                        nameOf(mentor),
                        titleOf(session),
                        startOf(session)));
    }

    @Async("emailTaskExecutor")
    public void sendBookingCompleted(User learner, User mentor, SkillSession session) {
        sendNotificationEmail(
                learner,
                "Mentorly: Booking completed",
                EmailTemplates.bookingCompletedToLearner(
                        nameOf(learner),
                        nameOf(mentor),
                        titleOf(session)));
    }

    @Async("emailTaskExecutor")
    public void sendBookingCancelled(User learner, SkillSession session, int refundPercent) {
        sendNotificationEmail(
                learner,
                "Mentorly: Booking cancelled",
                EmailTemplates.bookingCancelledToLearner(
                        nameOf(learner),
                        titleOf(session),
                        refundPercent));
    }

    @Async("emailTaskExecutor")
    public void sendVerificationApproved(User mentor) {
        sendNotificationEmail(
                mentor,
                "Mentorly: Mentor verification approved",
                EmailTemplates.mentorVerificationApproved(nameOf(mentor)));
    }

    @Async("emailTaskExecutor")
    public void sendVerificationRejected(User mentor, String reason) {
        sendNotificationEmail(
                mentor,
                "Mentorly: Mentor verification rejected",
                EmailTemplates.mentorVerificationRejected(nameOf(mentor), reason));
    }

    @Async("emailTaskExecutor")
    public void sendNotificationEmail(User user, String subject, String body) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }
        if (!emailEnabled) {
            log.info("Email disabled. Would send email to {} with subject: {}", user.getEmail(), subject);
            return;
        }

        try {
            emailTransport.send(user.getEmail(), subject, body);
        } catch (RuntimeException ex) {
            // Notification emails are best-effort: a provider outage must never
            // fail the booking/verification action that triggered them.
            log.warn("Failed to send notification email to {}: {}", user.getEmail(), ex.getMessage());
        }
    }

    /**
     * Send a raw email to an arbitrary address (for OTP, password reset, etc.).
     */
    public void sendRawEmail(String toEmail, String subject, String body) {
        if (toEmail == null || toEmail.isBlank()) {
            return;
        }
        if (!emailEnabled) {
            log.info("Email disabled. Would send email to {} with subject: {}", toEmail, subject);
            return;
        }

        // Codes must reach the user: transport failures propagate so the caller
        // can report them instead of pretending the email was delivered. The
        // transport's own timeouts cap this at roughly 10 seconds.
        emailTransport.send(toEmail, subject, body);
    }

    private static String nameOf(User user) {
        if (user == null || user.getFullName() == null || user.getFullName().isBlank()) {
            return "there";
        }
        return user.getFullName();
    }

    private static String titleOf(SkillSession session) {
        if (session == null || session.getTitle() == null || session.getTitle().isBlank()) {
            return "your session";
        }
        return session.getTitle();
    }

    private static String startOf(SkillSession session) {
        if (session == null || session.getStartTime() == null) {
            return "TBD";
        }
        return session.getStartTime().format(EMAIL_DATE_FORMATTER);
    }
}
