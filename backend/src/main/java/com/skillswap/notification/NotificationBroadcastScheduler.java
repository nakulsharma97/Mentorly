package com.skillswap.notification;

import com.skillswap.admin.AdminNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Polls for due {@link NotificationBroadcast} campaigns and sends them through
 * {@link AdminNotificationService}. Repeating broadcasts (DAILY / WEEKLY /
 * MONTHLY) are re-queued with their next occurrence so the same campaign keeps
 * firing; NONE repeats finish as SENT. A process-local flag prevents overlapping
 * runs on the same JVM.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationBroadcastScheduler {

    private final NotificationBroadcastRepository broadcastRepository;
    private final AdminNotificationService adminNotificationService;

    private final AtomicBoolean running = new AtomicBoolean(false);

    @Scheduled(fixedDelayString = "${app.notification.broadcast-poll-ms:30000}")
    public void processDueBroadcasts() {
        if (!running.compareAndSet(false, true)) {
            return; // previous run still in progress
        }
        try {
            OffsetDateTime now = OffsetDateTime.now();
            List<NotificationBroadcast> due = broadcastRepository.findDueScheduled(now);
            for (NotificationBroadcast broadcast : due) {
                try {
                    processOne(broadcast);
                } catch (Exception ex) {
                    log.error("Failed to send due broadcast {}: {}", broadcast.getId(), ex.getMessage());
                }
            }
        } finally {
            running.set(false);
        }
    }

    protected void processOne(NotificationBroadcast broadcast) {
        // sendBroadcast is @Transactional on the service bean, so the delivery
        // fan-out commits atomically. The re-queue below runs inside the
        // repository save's own transaction afterwards.
        adminNotificationService.sendBroadcast(broadcast);

        // Repeating broadcasts are re-queued for their next occurrence unless
        // they have an expiry that has passed. sendBroadcast marks the row SENT,
        // so we flip it back to SCHEDULED with the new schedule time here.
        boolean repeating = broadcast.getRepeatType() != null
                && !"NONE".equals(broadcast.getRepeatType());
        if (repeating) {
            OffsetDateTime next = nextOccurrence(broadcast.getRepeatType(), broadcast.getScheduleTime());
            if (broadcast.getExpiresAt() == null || next.isBefore(broadcast.getExpiresAt())) {
                broadcast.setScheduleTime(next);
                broadcast.setStatus(NotificationBroadcast.STATUS_SCHEDULED);
                broadcast.setUpdatedAt(OffsetDateTime.now());
            }
        }
        broadcastRepository.save(broadcast);
    }

    private static OffsetDateTime nextOccurrence(String repeatType, OffsetDateTime from) {
        OffsetDateTime base = from == null ? OffsetDateTime.now() : from;
        return switch (repeatType == null ? "NONE" : repeatType) {
            case "DAILY" -> base.plusDays(1);
            case "WEEKLY" -> base.plusWeeks(1);
            case "MONTHLY" -> base.plusMonths(1);
            default -> base;
        };
    }
}
