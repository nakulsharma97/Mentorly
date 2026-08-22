package com.skillswap.notification;

import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

/**
 * Service implementing email notification business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailNotificationService {

    private static final DateTimeFormatter EMAIL_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm XXX");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.email.enabled:false}")
    private boolean emailEnabled;

    @Value("${app.email.from:no-reply@mentorly.local}")
    private String fromAddress;

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

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Email enabled but JavaMailSender is not configured. Skipping email for {}", user.getEmail());
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(user.getEmail());
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to send notification email to {}", user.getEmail(), ex);
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

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Email enabled but JavaMailSender is not configured. Skipping email for {}", toEmail);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (MailException ex) {
            log.warn("Failed to send email to {}: {}", toEmail, ex.getMessage());
            throw new RuntimeException("Unable to send email. Please try again.");
        }
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
