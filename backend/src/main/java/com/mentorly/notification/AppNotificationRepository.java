package com.mentorly.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Spring Data repository for {@code AppNotification} persistence.
 */
public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {
    List<AppNotification> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<AppNotification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Page<AppNotification> findByUserIdAndReadFalseOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByUserIdAndReadFalse(Long userId);

    /** Unread notifications across all users — feeds the monitoring notification queue. */
    long countByReadFalse();

    /** Notifications created since a timestamp — feeds the platform-health queue card. */
    long countByCreatedAtAfter(OffsetDateTime createdAt);

    // ── Broadcast delivery tracking ──

    long countByBroadcastId(Long broadcastId);

    long countByBroadcastIdAndReadTrue(Long broadcastId);

    long countByBroadcastIdAndClickedAtNotNull(Long broadcastId);

    long countByBroadcastIdAndDismissedAtNotNull(Long broadcastId);

    long countByBroadcastIdAndDeliveryStatus(Long broadcastId, String deliveryStatus);

    Page<AppNotification> findByBroadcastIdOrderByCreatedAtDesc(Long broadcastId, Pageable pageable);

    List<AppNotification> findByBroadcastId(Long broadcastId);

    /** Per-broadcast delivery totals — [broadcastId, count], batch-fed to avoid N+1. */
    @Query("SELECT n.broadcastId, COUNT(n) FROM AppNotification n WHERE n.broadcastId IN :ids GROUP BY n.broadcastId")
    List<Object[]> countByBroadcastIdIn(@Param("ids") List<Long> ids);

    /** Per-broadcast read totals — [broadcastId, count]. */
    @Query("SELECT n.broadcastId, COUNT(n) FROM AppNotification n "
            + "WHERE n.broadcastId IN :ids AND n.read = true GROUP BY n.broadcastId")
    List<Object[]> countReadByBroadcastIdIn(@Param("ids") List<Long> ids);

    /** Per-broadcast click totals — [broadcastId, count]. */
    @Query("SELECT n.broadcastId, COUNT(n) FROM AppNotification n "
            + "WHERE n.broadcastId IN :ids AND n.clickedAt IS NOT NULL GROUP BY n.broadcastId")
    List<Object[]> countClickedByBroadcastIdIn(@Param("ids") List<Long> ids);

    // ── Notification-center analytics (all users) ──

    long countByReadTrue();

    long countByClickedAtNotNull();

    long countByDeliveryStatus(String deliveryStatus);

    /** Daily send volume for the last N days — [DATE, count] ascending. */
    @Query(value = "SELECT DATE(n.created_at) AS d, COUNT(*) AS cnt FROM app_notifications n "
            + "WHERE n.created_at >= :since GROUP BY DATE(n.created_at) ORDER BY d ASC", nativeQuery = true)
    List<Object[]> countDailySent(@Param("since") OffsetDateTime since);
}
