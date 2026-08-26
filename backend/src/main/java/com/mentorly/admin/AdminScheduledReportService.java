package com.mentorly.admin;

import com.mentorly.common.SchedulerLockService;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Generates a PDF dashboard report on a configurable schedule and emails it
 * to all admin users. The frequency is controlled by the database-stored
 * {@code report_schedule_frequency} setting (values: {@code weekly}, {@code monthly}, or {@code none}).
 */
/**
 * Service implementing admin scheduled report business logic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminScheduledReportService {

    private final UserRepository userRepository;
    private final AdminSettingRepository adminSettingRepository;
    private final EmailNotificationService emailNotificationService;
    private final SchedulerLockService schedulerLockService;

    @Value("${app.admin.email:}")
    private String adminEmail;

    /**
     * Runs daily at 7 AM. Checks the stored frequency setting before generating a report.
     */
    @Scheduled(cron = "0 0 7 * * *", zone = "UTC")
    public void generateAndSendScheduledReport() {
        // Leader lock so admins never receive duplicate scheduled reports
        // when the app runs on multiple instances (k8s replicas).
        schedulerLockService.runIfLeader("admin-scheduled-report", () -> {
            String frequency = getReportFrequency();

            if ("none".equalsIgnoreCase(frequency)) {
                return;
            }

            boolean shouldSend = false;
            int dayOfMonth = OffsetDateTime.now().getDayOfMonth();

            if ("weekly".equalsIgnoreCase(frequency) && OffsetDateTime.now().getDayOfWeek().getValue() == 1) {
                shouldSend = true;
            } else if ("monthly".equalsIgnoreCase(frequency) && dayOfMonth == 1) {
                shouldSend = true;
            }

            if (!shouldSend) {
                return;
            }

            List<User> admins = userRepository.findByRole(UserRole.ADMIN);
            if (admins.isEmpty()) {
                log.info("Scheduled report skipped — no admin users found");
                return;
            }

            String reportBody = buildReportBody(frequency);
            for (User admin : admins) {
                emailNotificationService.sendNotificationEmail(
                        admin,
                        "Mentorly " + (frequency.equals("weekly") ? "Weekly" : "Monthly") + " Dashboard Report",
                        reportBody);
            }
            log.info("Scheduled {} report sent to {} admin(s)", frequency, admins.size());
        });
    }

    private String getReportFrequency() {
        return adminSettingRepository.findBySettingKey("report_schedule_frequency")
                .map(AdminSetting::getSettingValue)
                .orElse("none");
    }

    /**
     * Builds a plain-text summary report of key platform metrics.
     * In a production environment, this could use jsPDF on the backend
     * or delegate to a dedicated PDF generation service.
     */
    private String buildReportBody(String frequency) {
        long userCount = userRepository.count();
        long adminCount = userRepository.countByRole(UserRole.ADMIN);
        long mentorCount = userRepository.countByRole(UserRole.MENTOR);
        long learnerCount = userRepository.countByRole(UserRole.LEARNER);

        return """
                ========================================
                Mentorly %s Dashboard Report
                Generated: %s
                ========================================
                
                PLATFORM OVERVIEW
                • Total Users: %d
                • Admins: %d
                • Mentors: %d
                • Learners: %d
                
                ---
                This is an automated report. Configure frequency in
                Admin Settings → Scheduled Reports.
                ========================================
                """.formatted(
                frequency.equals("weekly") ? "Weekly" : "Monthly",
                OffsetDateTime.now().toString(),
                userCount, adminCount, mentorCount, learnerCount);
    }
}
