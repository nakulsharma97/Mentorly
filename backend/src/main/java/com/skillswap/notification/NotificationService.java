package com.skillswap.notification;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final AppNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final EmailNotificationService emailNotificationService;
    private final NotificationWebSocketHandler webSocketHandler;

    public void notifyUser(Long userId, String type, String title, String message, Long referenceId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        AppNotification notification = new AppNotification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setReferenceId(referenceId);
        notificationRepository.save(notification);

        // Push real-time notification via WebSocket
        webSocketHandler.broadcastToUser(userId, notification);

        NotificationPreference preference = getOrCreatePreference(user);
        if (shouldSendEmail(preference, user.getRole(), type)) {
            emailNotificationService.sendNotificationEmail(
                    user,
                    "SkillSwap: " + title,
                    message + "\n\nType: " + type + "\nReference: " + (referenceId == null ? "n/a" : referenceId));
        }
    }

    public void notifyUsers(Collection<Long> userIds, String type, String title, String message, Long referenceId) {
        userIds.stream().distinct().forEach(userId -> notifyUser(userId, type, title, message, referenceId));
    }

    public NotificationPreference getOrCreatePreference(User user) {
        return preferenceRepository.findByUserId(user.getId()).orElseGet(() -> {
            NotificationPreference preference = new NotificationPreference();
            preference.setUser(user);
            return preferenceRepository.save(preference);
        });
    }

    public NotificationPreference updatePreference(
            User user,
            boolean emailEnabled,
            boolean bookingUpdates,
            boolean sessionAnnouncements,
            boolean reviewAlerts,
            boolean certificationAlerts,
            boolean roleChangeAlerts) {
        NotificationPreference preference = getOrCreatePreference(user);
        preference.setEmailEnabled(emailEnabled);
        preference.setBookingUpdates(bookingUpdates);
        preference.setSessionAnnouncements(sessionAnnouncements);
        preference.setReviewAlerts(reviewAlerts);
        preference.setCertificationAlerts(certificationAlerts);
        preference.setRoleChangeAlerts(roleChangeAlerts);
        return preferenceRepository.save(preference);
    }

    private static boolean shouldSendEmail(NotificationPreference preference, UserRole role, String type) {
        if (!preference.isEmailEnabled()) {
            return false;
        }

        if ("BOOKING_CREATED".equals(type) || "BOOKING_STATUS".equals(type) || "WAITLIST_PROMOTION".equals(type)) {
            return preference.isBookingUpdates();
        }
        if ("NEW_SESSION".equals(type) && role == UserRole.LEARNER) {
            return preference.isSessionAnnouncements();
        }
        if (("REVIEW_SUBMITTED".equals(type) || "NEW_REVIEW".equals(type)) && role == UserRole.MENTOR) {
            return preference.isReviewAlerts();
        }
        if ("CERTIFICATION_EARNED".equals(type)) {
            return preference.isCertificationAlerts();
        }
        if ("ROLE_SWITCHED".equals(type)) {
            return preference.isRoleChangeAlerts();
        }
        return true;
    }
}
