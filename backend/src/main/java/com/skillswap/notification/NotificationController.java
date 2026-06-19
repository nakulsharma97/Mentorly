package com.skillswap.notification;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final AppNotificationRepository notificationRepository;
    private final NotificationService notificationService;

    @GetMapping
    public ApiResponse<List<AppNotification>> list(@AuthenticationPrincipal User user) {
        return new ApiResponse<>("Notifications fetched",
                notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> unreadCount(@AuthenticationPrincipal User user) {
        return new ApiResponse<>("Unread count fetched",
                notificationRepository.countByUserIdAndReadFalse(user.getId()));
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<AppNotification> markRead(@AuthenticationPrincipal User user, @PathVariable Long id) {
        AppNotification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));

        if (!notification.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Cannot update another user's notification");
        }

        notification.setRead(true);
        return new ApiResponse<>("Notification marked as read", notificationRepository.save(notification));
    }

    @PatchMapping("/mark-all-read")
    public ApiResponse<Integer> markAllRead(@AuthenticationPrincipal User user) {
        List<AppNotification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        int updated = 0;
        for (AppNotification notification : notifications) {
            if (!notification.isRead()) {
                notification.setRead(true);
                updated++;
            }
        }
        notificationRepository.saveAll(notifications);
        return new ApiResponse<>("All notifications marked as read", updated);
    }

    @GetMapping("/preferences")
    public ApiResponse<NotificationPreferencesResponse> preferences(@AuthenticationPrincipal User user) {
        NotificationPreference preference = notificationService.getOrCreatePreference(user);
        return new ApiResponse<>("Notification preferences fetched", NotificationPreferencesResponse.from(preference));
    }

    @PutMapping("/preferences")
    public ApiResponse<NotificationPreferencesResponse> updatePreferences(
            @AuthenticationPrincipal User user,
            @RequestBody UpdateNotificationPreferencesRequest request) {
        NotificationPreference preference = notificationService.updatePreference(
                user,
                request.emailEnabled(),
                request.bookingUpdates(),
                request.sessionAnnouncements(),
                request.reviewAlerts(),
                request.certificationAlerts(),
                request.roleChangeAlerts());
        return new ApiResponse<>("Notification preferences updated", NotificationPreferencesResponse.from(preference));
    }

    public record UpdateNotificationPreferencesRequest(
            boolean emailEnabled,
            boolean bookingUpdates,
            boolean sessionAnnouncements,
            boolean reviewAlerts,
            boolean certificationAlerts,
            boolean roleChangeAlerts) {
    }

    public record NotificationPreferencesResponse(
            boolean emailEnabled,
            boolean bookingUpdates,
            boolean sessionAnnouncements,
            boolean reviewAlerts,
            boolean certificationAlerts,
            boolean roleChangeAlerts) {
        static NotificationPreferencesResponse from(NotificationPreference preference) {
            return new NotificationPreferencesResponse(
                    preference.isEmailEnabled(),
                    preference.isBookingUpdates(),
                    preference.isSessionAnnouncements(),
                    preference.isReviewAlerts(),
                    preference.isCertificationAlerts(),
                    preference.isRoleChangeAlerts());
        }
    }
}
