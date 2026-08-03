package com.skillswap.admin;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.common.AuditLogService;
import com.skillswap.notification.AppNotification;
import com.skillswap.notification.AppNotificationRepository;
import com.skillswap.notification.NotificationBroadcast;
import com.skillswap.notification.NotificationBroadcastRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Service layer for the Admin Notification & Broadcast Center.
 *
 * <p>Owns the broadcast-campaign lifecycle (draft → scheduled/sending →
 * sent/cancelled/failed/archived), resolves target audiences, fans out
 * deliveries through the existing {@link NotificationService} pipeline
 * (DB persist + WebSocket push + preference-gated email), and produces the
 * dashboard stats, history, detail, recipients, and analytics payloads the
 * admin UI renders. Every state-changing call writes an audit log entry.</p>
 */
/**
 * Service implementing admin notification business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminNotificationService {

    private final NotificationBroadcastRepository broadcastRepository;
    private final AppNotificationRepository appNotificationRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final SessionRepository sessionRepository;
    private final MentorVerificationRequestRepository verificationRepository;
    private final NotificationService notificationService;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    // ═══════════════════════════════════════════════════════════
    //  Audience resolution
    // ═══════════════════════════════════════════════════════════

    /**
     * Resolves the target user ids for a broadcast based on its scope and
     * (optional) detail JSON. Disabled accounts are always excluded.
     */
    public List<Long> resolveAudience(NotificationBroadcast broadcast) {
        String scope = broadcast.getTargetScope() == null ? "ALL" : broadcast.getTargetScope();
        Map<String, Object> detail = parseDetail(broadcast.getTargetDetail());

        List<User> users = new ArrayList<>();
        switch (scope) {
            case "MENTORS" -> users.addAll(userRepository
                    .findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole.MENTOR));
            case "LEARNERS" -> users.addAll(userRepository
                    .findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole.LEARNER));
            case "VERIFIED_MENTORS" -> users.addAll(userRepository
                    .findByRoleAndMentorVerifiedTrueAndEnabledTrue(UserRole.MENTOR));
            case "UNVERIFIED_MENTORS" -> users.addAll(userRepository
                    .findByRoleAndMentorVerifiedFalseAndEnabledTrue(UserRole.MENTOR));
            case "ROLES" -> {
                for (Object raw : stringList(detail.get("roles"))) {
                    try {
                        UserRole role = UserRole.valueOf(String.valueOf(raw).toUpperCase());
                        users.addAll(userRepository.findByRoleAndEnabledTrueOrderByLastActiveAtDesc(role));
                    } catch (IllegalArgumentException ignored) {
                        // skip unknown roles
                    }
                }
            }
            case "SKILLS" -> {
                for (Object skill : stringList(detail.get("skills"))) {
                    String s = String.valueOf(skill).trim();
                    if (s.isEmpty()) {
                        continue;
                    }
                    users.addAll(userRepository
                            .findByRoleAndEnabledTrueAndSkillsContainingIgnoreCaseOrderByLastActiveAtDesc(
                                    UserRole.MENTOR, s));
                    users.addAll(userRepository
                            .findByRoleAndEnabledTrueAndSkillsContainingIgnoreCaseOrderByLastActiveAtDesc(
                                    UserRole.LEARNER, s));
                }
            }
            case "SPECIFIC_USERS" -> {
                List<Long> ids = longList(detail.get("userIds"));
                if (!ids.isEmpty()) {
                    for (User u : userRepository.findAllById(ids)) {
                        if (u.isEnabled()) {
                            users.add(u);
                        }
                    }
                }
            }
            case "SESSION_PARTICIPANTS" -> {
                for (Object raw : stringList(detail.get("sessionIds"))) {
                    Long sessionId = parseLong(String.valueOf(raw));
                    if (sessionId == null) {
                        continue;
                    }
                    for (Booking b : bookingRepository.findBySessionId(sessionId)) {
                        if (b.getLearner() != null && b.getLearner().isEnabled()) {
                            users.add(b.getLearner());
                        }
                    }
                    sessionRepository.findById(sessionId).ifPresent(s -> {
                        if (s.getMentor() != null && s.getMentor().isEnabled()) {
                            users.add(s.getMentor());
                        }
                    });
                }
            }
            case "VERIFICATION_REQUESTS" -> {
                for (Object raw : stringList(detail.get("verificationStatuses"))) {
                    try {
                        MentorVerificationRequestStatus status =
                                MentorVerificationRequestStatus.valueOf(String.valueOf(raw).toUpperCase());
                        verificationRepository.findByStatusOrderByCreatedAtAsc(status)
                                .forEach(r -> {
                                    if (r.getMentor() != null && r.getMentor().isEnabled()) {
                                        users.add(r.getMentor());
                                    }
                                });
                    } catch (IllegalArgumentException ignored) {
                        // skip unknown statuses
                    }
                }
            }
            // case "ALL" and unknown scopes fall through to all enabled users
            default -> users.addAll(userRepository.findAll().stream().filter(User::isEnabled).toList());
        }

        return users.stream().map(User::getId).distinct().toList();
    }

    // ═══════════════════════════════════════════════════════════
    //  Campaign lifecycle
    // ═══════════════════════════════════════════════════════════

    /**
     * Creates a broadcast from a request. When no schedule time is given the
     * broadcast is sent immediately; when a future time is given it is stored
     * as SCHEDULED and picked up by {@link NotificationBroadcastScheduler}.
     * Sending sets status to SENDING, fans out deliveries, then SENT.
     */
    @Transactional
    public NotificationBroadcast createBroadcast(
            User admin, String title, String subtitle, String message, String type, String priority,
            String targetScope, String targetDetail, OffsetDateTime scheduleTime, OffsetDateTime expiresAt,
            String repeatType, String actionButtonText, String actionUrl, boolean sendNow) {

        NotificationBroadcast b = new NotificationBroadcast();
        b.setTitle(title);
        b.setSubtitle(subtitle);
        b.setMessage(message);
        b.setType(normalizeType(type));
        b.setPriority(normalizePriority(priority));
        b.setTargetScope(targetScope == null || targetScope.isBlank() ? "ALL" : targetScope.trim().toUpperCase());
        b.setTargetDetail(targetDetail);
        b.setScheduleTime(scheduleTime);
        b.setExpiresAt(expiresAt);
        b.setRepeatType(normalizeRepeat(repeatType));
        b.setActionButtonText(actionButtonText);
        b.setActionUrl(actionUrl);
        b.setCreatedBy(admin);

        boolean immediate = sendNow || scheduleTime == null;
        if (immediate) {
            b.setStatus(NotificationBroadcast.STATUS_SENDING);
        } else {
            b.setStatus(scheduleTime.isAfter(OffsetDateTime.now())
                    ? NotificationBroadcast.STATUS_SCHEDULED
                    : NotificationBroadcast.STATUS_SENDING);
        }
        NotificationBroadcast saved = broadcastRepository.save(b);

        if (NotificationBroadcast.STATUS_SENDING.equals(saved.getStatus())) {
            sendBroadcast(saved);
            return broadcastRepository.save(saved);
        }
        saveAuditLog(admin, "CREATE_BROADCAST", "NotificationBroadcast", saved.getId(),
                "Scheduled '" + title + "' (" + saved.getType() + ") for " + scheduleTime);
        return saved;
    }

    /** Fans out the broadcast to its resolved audience and updates counters. */
    @Transactional
    public void sendBroadcast(NotificationBroadcast broadcast) {
        List<Long> userIds = resolveAudience(broadcast);
        broadcast.setTotalTargets(userIds.size());
        broadcast.setStatus(NotificationBroadcast.STATUS_SENDING);
        broadcast.setUpdatedAt(OffsetDateTime.now());

        int delivered = 0;
        int failed = 0;
        for (Long userId : userIds) {
            try {
                notificationService.notifyUser(userId, broadcast.getType(), broadcast.getTitle(),
                        broadcast.getMessage(), broadcast.getId(), broadcast.getId(),
                        broadcast.getPriority(), broadcast.getActionUrl(),
                        broadcast.getActionButtonText(), broadcast.getExpiresAt());
                delivered++;
            } catch (Exception ex) {
                failed++;
                log.warn("Broadcast {} failed to deliver to user {}: {}",
                        broadcast.getId(), userId, ex.getMessage());
            }
        }

        broadcast.setDeliveredCount(delivered);
        broadcast.setFailedCount(failed);
        broadcast.setSentAt(OffsetDateTime.now());
        broadcast.setStatus(failed == delivered && delivered > 0
                ? NotificationBroadcast.STATUS_FAILED
                : NotificationBroadcast.STATUS_SENT);
        broadcast.setUpdatedAt(OffsetDateTime.now());
    }

    /** Edits a DRAFT or SCHEDULED broadcast (the only editable states). */
    @Transactional
    public NotificationBroadcast editBroadcast(User admin, Long id, String title, String subtitle,
            String message, String type, String priority, String targetScope, String targetDetail,
            OffsetDateTime scheduleTime, OffsetDateTime expiresAt, String repeatType,
            String actionButtonText, String actionUrl) {
        NotificationBroadcast b = findActive(id);
        if (!NotificationBroadcast.STATUS_DRAFT.equals(b.getStatus())
                && !NotificationBroadcast.STATUS_SCHEDULED.equals(b.getStatus())) {
            throw new IllegalArgumentException("Only DRAFT or SCHEDULED broadcasts can be edited");
        }
        b.setTitle(title);
        b.setSubtitle(subtitle);
        b.setMessage(message);
        b.setType(normalizeType(type));
        b.setPriority(normalizePriority(priority));
        b.setTargetScope(targetScope == null || targetScope.isBlank() ? "ALL" : targetScope.trim().toUpperCase());
        b.setTargetDetail(targetDetail);
        b.setScheduleTime(scheduleTime);
        b.setExpiresAt(expiresAt);
        b.setRepeatType(normalizeRepeat(repeatType));
        b.setActionButtonText(actionButtonText);
        b.setActionUrl(actionUrl);
        b.setUpdatedAt(OffsetDateTime.now());
        NotificationBroadcast saved = broadcastRepository.save(b);
        saveAuditLog(admin, "EDIT_BROADCAST", "NotificationBroadcast", id, "Edited '" + title + "'");
        return saved;
    }

    /** Sends a DRAFT or SCHEDULED broadcast immediately. */
    @Transactional
    public NotificationBroadcast sendNow(User admin, Long id) {
        NotificationBroadcast b = findActive(id);
        if (!NotificationBroadcast.STATUS_DRAFT.equals(b.getStatus())
                && !NotificationBroadcast.STATUS_SCHEDULED.equals(b.getStatus())) {
            throw new IllegalArgumentException("Only DRAFT or SCHEDULED broadcasts can be sent now");
        }
        sendBroadcast(b);
        NotificationBroadcast saved = broadcastRepository.save(b);
        saveAuditLog(admin, "SEND_BROADCAST", "NotificationBroadcast", id,
                "Sent '" + b.getTitle() + "' to " + b.getDeliveredCount() + " users");
        return saved;
    }

    /** Cancels a SCHEDULED broadcast so it never fires. */
    @Transactional
    public NotificationBroadcast cancelScheduled(User admin, Long id) {
        NotificationBroadcast b = findActive(id);
        if (!NotificationBroadcast.STATUS_SCHEDULED.equals(b.getStatus())) {
            throw new IllegalArgumentException("Only SCHEDULED broadcasts can be cancelled");
        }
        b.setStatus(NotificationBroadcast.STATUS_CANCELLED);
        b.setCancelledAt(OffsetDateTime.now());
        b.setUpdatedAt(OffsetDateTime.now());
        NotificationBroadcast saved = broadcastRepository.save(b);
        saveAuditLog(admin, "CANCEL_BROADCAST", "NotificationBroadcast", id,
                "Cancelled scheduled broadcast '" + b.getTitle() + "'");
        return saved;
    }

    /** Duplicates a broadcast as a new DRAFT so the admin can tweak and resend. */
    @Transactional
    public NotificationBroadcast duplicate(User admin, Long id) {
        NotificationBroadcast source = findActive(id);
        NotificationBroadcast copy = new NotificationBroadcast();
        copy.setTitle(source.getTitle() + " (copy)");
        copy.setSubtitle(source.getSubtitle());
        copy.setMessage(source.getMessage());
        copy.setType(source.getType());
        copy.setPriority(source.getPriority());
        copy.setTargetScope(source.getTargetScope());
        copy.setTargetDetail(source.getTargetDetail());
        copy.setScheduleTime(null);
        copy.setExpiresAt(source.getExpiresAt());
        copy.setRepeatType(source.getRepeatType());
        copy.setActionButtonText(source.getActionButtonText());
        copy.setActionUrl(source.getActionUrl());
        copy.setCreatedBy(admin);
        copy.setStatus(NotificationBroadcast.STATUS_DRAFT);
        NotificationBroadcast saved = broadcastRepository.save(copy);
        saveAuditLog(admin, "DUPLICATE_BROADCAST", "NotificationBroadcast", id,
                "Duplicated '" + source.getTitle() + "' as draft #" + saved.getId());
        return saved;
    }

    /** Archives a broadcast so it leaves the active history while staying stored. */
    @Transactional
    public NotificationBroadcast archive(User admin, Long id) {
        NotificationBroadcast b = findActive(id);
        b.setStatus(NotificationBroadcast.STATUS_ARCHIVED);
        b.setArchivedAt(OffsetDateTime.now());
        b.setUpdatedAt(OffsetDateTime.now());
        NotificationBroadcast saved = broadcastRepository.save(b);
        saveAuditLog(admin, "ARCHIVE_BROADCAST", "NotificationBroadcast", id,
                "Archived broadcast '" + b.getTitle() + "'");
        return saved;
    }

    /** Soft-deletes a broadcast (kept for audit, excluded from all lists). */
    @Transactional
    public void delete(User admin, Long id) {
        NotificationBroadcast b = findActive(id);
        b.setDeletedAt(OffsetDateTime.now());
        b.setUpdatedAt(OffsetDateTime.now());
        broadcastRepository.save(b);
        saveAuditLog(admin, "DELETE_BROADCAST", "NotificationBroadcast", id,
                "Deleted broadcast '" + b.getTitle() + "'");
    }

    /** Resends a SENT broadcast to everyone who has not read it yet. */
    @Transactional
    public int resendToUnread(User admin, Long id) {
        NotificationBroadcast b = findActive(id);
        if (!NotificationBroadcast.STATUS_SENT.equals(b.getStatus())
                && !NotificationBroadcast.STATUS_FAILED.equals(b.getStatus())) {
            throw new IllegalArgumentException("Only SENT or FAILED broadcasts can be resent");
        }
        List<AppNotification> deliveries = appNotificationRepository.findByBroadcastId(id);
        List<Long> unreadUserIds = deliveries.stream()
                .filter(n -> !n.isRead())
                .map(n -> n.getUser().getId())
                .distinct()
                .toList();
        int resent = 0;
        for (Long userId : unreadUserIds) {
            try {
                notificationService.notifyUser(userId, b.getType(), b.getTitle(), b.getMessage(),
                        b.getId(), b.getId(), b.getPriority(), b.getActionUrl(),
                        b.getActionButtonText(), b.getExpiresAt());
                resent++;
            } catch (Exception ex) {
                log.warn("Resend broadcast {} failed for user {}: {}", id, userId, ex.getMessage());
            }
        }
        b.setSentAt(OffsetDateTime.now());
        b.setUpdatedAt(OffsetDateTime.now());
        broadcastRepository.save(b);
        saveAuditLog(admin, "RESEND_BROADCAST", "NotificationBroadcast", id,
                "Resent '" + b.getTitle() + "' to " + resent + " unread users");
        return resent;
    }

    // ═══════════════════════════════════════════════════════════
    //  Reads — dashboard / history / detail / recipients / analytics
    // ═══════════════════════════════════════════════════════════

    /** Dashboard stats — all real database counts, no hardcoded values. */
    @Transactional(readOnly = true)
    public Map<String, Object> dashboardStats() {
        OffsetDateTime todayStart = OffsetDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);

        long totalBroadcasts = broadcastRepository.countByDeletedAtIsNull();
        long sent = broadcastRepository.countByDeletedAtIsNullAndStatus(NotificationBroadcast.STATUS_SENT);
        long scheduled = broadcastRepository.countByDeletedAtIsNullAndStatus(NotificationBroadcast.STATUS_SCHEDULED);
        long drafts = broadcastRepository.countByDeletedAtIsNullAndStatus(NotificationBroadcast.STATUS_DRAFT);
        long cancelled = broadcastRepository.countByDeletedAtIsNullAndStatus(NotificationBroadcast.STATUS_CANCELLED);
        long failed = broadcastRepository.countByDeletedAtIsNullAndStatus(NotificationBroadcast.STATUS_FAILED);

        long totalNotifications = appNotificationRepository.count();
        long unread = appNotificationRepository.countByReadFalse();
        long read = appNotificationRepository.countByReadTrue();
        long sentToday = appNotificationRepository.countByCreatedAtAfter(todayStart);
        long failedDeliveries = appNotificationRepository.countByDeliveryStatus("FAILED");

        long announcements = broadcastRepository.countByDeletedAtIsNullAndType("ANNOUNCEMENT");
        long maintenance = broadcastRepository.countByDeletedAtIsNullAndType("MAINTENANCE");
        long platformUpdates = broadcastRepository.countByDeletedAtIsNullAndType("PLATFORM_UPDATE");

        long delivered = totalNotifications - failedDeliveries;
        double successRate = totalNotifications == 0 ? 0
                : Math.round(delivered * 100.0 / totalNotifications * 10.0) / 10.0;

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalBroadcasts", totalBroadcasts);
        stats.put("sent", sent);
        stats.put("scheduled", scheduled);
        stats.put("drafts", drafts);
        stats.put("cancelled", cancelled);
        stats.put("failedBroadcasts", failed);
        stats.put("totalNotifications", totalNotifications);
        stats.put("unread", unread);
        stats.put("read", read);
        stats.put("sentToday", sentToday);
        stats.put("failedDeliveries", failedDeliveries);
        stats.put("announcements", announcements);
        stats.put("maintenance", maintenance);
        stats.put("platformUpdates", platformUpdates);
        stats.put("successRate", successRate);
        return stats;
    }

    /** Paginated broadcast history with optional search + filters. */
    @Transactional(readOnly = true)
    public Page<Map<String, Object>> history(String type, String priority, String status, String scope,
            String q, String fromDate, String toDate, Pageable pageable) {
        OffsetDateTime from = parseDate(fromDate, false);
        OffsetDateTime to = parseDate(toDate, true);
        Page<NotificationBroadcast> page = broadcastRepository.findByFilters(
                normalizeOrNull(type), normalizeOrNull(priority), normalizeOrNull(status),
                normalizeOrNull(scope), q, from, to, pageable);

        List<Long> ids = page.getContent().stream().map(NotificationBroadcast::getId).toList();
        Map<Long, Long> deliveredMap = new java.util.HashMap<>();
        Map<Long, Long> readMap = new java.util.HashMap<>();
        Map<Long, Long> clickedMap = new java.util.HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : appNotificationRepository.countByBroadcastIdIn(ids)) {
                deliveredMap.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
            for (Object[] row : appNotificationRepository.countReadByBroadcastIdIn(ids)) {
                readMap.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
            for (Object[] row : appNotificationRepository.countClickedByBroadcastIdIn(ids)) {
                clickedMap.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }
        return page.map(b -> toRow(b, deliveredMap, readMap, clickedMap));
    }

    /** Full detail for a single broadcast, including live delivery counters. */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(Long id) {
        NotificationBroadcast b = findActive(id);
        long delivered = appNotificationRepository.countByBroadcastId(id);
        long read = appNotificationRepository.countByBroadcastIdAndReadTrue(id);
        long clicked = appNotificationRepository.countByBroadcastIdAndClickedAtNotNull(id);
        long dismissed = appNotificationRepository.countByBroadcastIdAndDismissedAtNotNull(id);
        long failed = appNotificationRepository.countByBroadcastIdAndDeliveryStatus(id, "FAILED");

        Map<String, Object> map = toRow(b, Map.of(b.getId(), delivered), Map.of(b.getId(), read),
                Map.of(b.getId(), clicked));
        map.put("dismissed", dismissed);
        map.put("failedDeliveries", failed);
        map.put("unread", Math.max(0, delivered - read));
        map.put("createdByName", b.getCreatedBy() != null ? b.getCreatedBy().getFullName() : "Unknown");
        map.put("createdByEmail", b.getCreatedBy() != null ? b.getCreatedBy().getEmail() : "");
        return map;
    }

    /** Paginated list of individual deliveries for the recipients panel. */
    @Transactional(readOnly = true)
    public Page<Map<String, Object>> recipients(Long broadcastId, Pageable pageable) {
        Page<AppNotification> page = appNotificationRepository
                .findByBroadcastIdOrderByCreatedAtDesc(broadcastId, pageable);
        return page.map(n -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", n.getId());
            m.put("userId", n.getUser().getId());
            m.put("userName", n.getUser().getFullName());
            m.put("userEmail", n.getUser().getEmail());
            m.put("userUsername", n.getUser().getDisplayUsername());
            m.put("role", n.getUser().getRole().name());
            m.put("read", n.isRead());
            m.put("readAt", n.getReadAt());
            m.put("clickedAt", n.getClickedAt());
            m.put("dismissedAt", n.getDismissedAt());
            m.put("deliveryStatus", n.getDeliveryStatus());
            m.put("createdAt", n.getCreatedAt());
            return m;
        });
    }

    /** Analytics — read/click/delivery rates, most-opened, monthly + daily trends. */
    @Transactional(readOnly = true)
    public Map<String, Object> analytics(int months) {
        months = Math.max(1, Math.min(24, months));
        OffsetDateTime since = OffsetDateTime.now().minusMonths(months - 1L)
                .withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);

        long totalDelivered = appNotificationRepository.countByDeliveryStatus("DELIVERED")
                + appNotificationRepository.countByDeliveryStatus("FAILED")
                + appNotificationRepository.countByDeliveryStatus("EXPIRED")
                + appNotificationRepository.countByDeliveryStatus("DISMISSED");
        long read = appNotificationRepository.countByReadTrue();
        long clicked = appNotificationRepository.countByClickedAtNotNull();
        long delivered = appNotificationRepository.countByDeliveryStatus("DELIVERED");
        long failed = appNotificationRepository.countByDeliveryStatus("FAILED");

        // Most-opened campaigns — the entity's stored readCount is never
        // maintained by the user read/click paths, so we rank by the live
        // per-broadcast read totals computed from app_notifications.
        List<NotificationBroadcast> candidates = broadcastRepository.findByDeletedAtIsNullOrderByCreatedAtDesc();
        List<Long> candidateIds = candidates.stream().map(NotificationBroadcast::getId).toList();
        Map<Long, Long> readByBroadcast = new java.util.HashMap<>();
        if (!candidateIds.isEmpty()) {
            for (Object[] row : appNotificationRepository.countReadByBroadcastIdIn(candidateIds)) {
                readByBroadcast.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }
        List<NotificationBroadcast> top = candidates.stream()
                .sorted(java.util.Comparator
                        .comparingLong((NotificationBroadcast b) -> readByBroadcast.getOrDefault(b.getId(), 0L))
                        .reversed())
                .limit(5)
                .toList();

        // Monthly broadcast-volume trend
        List<Object[]> monthlyRows = broadcastRepository.computeMonthlyTrend(since);
        Map<Integer, Long> monthMap = new java.util.HashMap<>();
        for (Object[] row : monthlyRows) {
            monthMap.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        List<Map<String, Object>> monthly = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            OffsetDateTime m = since.plusMonths(i);
            int key = m.getYear() * 100 + m.getMonthValue();
            monthly.add(Map.of(
                    "label", m.format(java.time.format.DateTimeFormatter.ofPattern("MMM yy")),
                    "value", monthMap.getOrDefault(key, 0L)));
        }

        // Daily send volume for the last 30 days
        List<Object[]> dailyRows = appNotificationRepository.countDailySent(OffsetDateTime.now().minusDays(29));
        Map<java.time.LocalDate, Long> dailyMap = new java.util.HashMap<>();
        for (Object[] row : dailyRows) {
            java.time.LocalDate d = toLocalDate(row[0]);
            if (d != null) {
                dailyMap.put(d, ((Number) row[1]).longValue());
            }
        }
        java.time.format.DateTimeFormatter dayFmt = java.time.format.DateTimeFormatter.ofPattern("MMM d");
        List<Map<String, Object>> daily = new ArrayList<>();
        for (int i = 29; i >= 0; i--) {
            java.time.LocalDate d = java.time.LocalDate.now().minusDays(i);
            daily.add(Map.of("label", dayFmt.format(d), "value", dailyMap.getOrDefault(d, 0L)));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalDelivered", totalDelivered);
        result.put("delivered", delivered);
        result.put("failed", failed);
        result.put("read", read);
        result.put("readRate", totalDelivered == 0 ? 0
                : Math.round(read * 100.0 / totalDelivered * 10.0) / 10.0);
        result.put("clicked", clicked);
        result.put("clickRate", totalDelivered == 0 ? 0
                : Math.round(clicked * 100.0 / totalDelivered * 10.0) / 10.0);
        result.put("deliverySuccess", (delivered + failed) == 0 ? 0
                : Math.round(delivered * 100.0 / (delivered + failed) * 10.0) / 10.0);
        result.put("monthly", monthly);
        result.put("daily", daily);
        result.put("mostOpened", top.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", b.getId());
            m.put("title", b.getTitle());
            m.put("type", b.getType());
            m.put("readCount", appNotificationRepository.countByBroadcastIdAndReadTrue(b.getId()));
            m.put("sentAt", b.getSentAt());
            return m;
        }).toList());
        return result;
    }

    // ═══════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════

    private Map<String, Object> toRow(NotificationBroadcast b, Map<Long, Long> deliveredMap,
            Map<Long, Long> readMap, Map<Long, Long> clickedMap) {
        long delivered = deliveredMap.getOrDefault(b.getId(), 0L);
        long read = readMap.getOrDefault(b.getId(), 0L);
        long clicked = clickedMap.getOrDefault(b.getId(), 0L);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("title", b.getTitle());
        m.put("subtitle", b.getSubtitle());
        m.put("message", b.getMessage());
        m.put("type", b.getType());
        m.put("priority", b.getPriority());
        m.put("status", b.getStatus());
        m.put("targetScope", b.getTargetScope());
        m.put("targetDetail", b.getTargetDetail());
        m.put("scheduleTime", b.getScheduleTime());
        m.put("sentAt", b.getSentAt());
        m.put("expiresAt", b.getExpiresAt());
        m.put("repeatType", b.getRepeatType());
        m.put("actionButtonText", b.getActionButtonText());
        m.put("actionUrl", b.getActionUrl());
        m.put("totalTargets", b.getTotalTargets());
        m.put("delivered", delivered);
        m.put("read", read);
        m.put("clicked", clicked);
        m.put("unread", Math.max(0, delivered - read));
        m.put("createdByName", b.getCreatedBy() != null ? b.getCreatedBy().getFullName() : "Unknown");
        m.put("createdAt", b.getCreatedAt());
        return m;
    }

    private NotificationBroadcast findActive(Long id) {
        return broadcastRepository.findActiveById(id)
                .orElseThrow(() -> new IllegalArgumentException("Broadcast not found"));
    }

    private static String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "ANNOUNCEMENT";
        }
        String t = type.trim().toUpperCase();
        List<String> valid = List.of("ANNOUNCEMENT", "MAINTENANCE", "PLATFORM_UPDATE", "SECURITY_ALERT",
                "PAYMENT_NOTIFICATION", "SESSION_REMINDER", "VERIFICATION_UPDATE", "REPORT_RESOLUTION",
                "WARNING", "ACCOUNT_SUSPENSION", "ACCOUNT_RESTORATION", "CUSTOM");
        return valid.contains(t) ? t : "ANNOUNCEMENT";
    }

    private static String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "MEDIUM";
        }
        String p = priority.trim().toUpperCase();
        List<String> valid = List.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
        return valid.contains(p) ? p : "MEDIUM";
    }

    private static String normalizeRepeat(String repeat) {
        if (repeat == null || repeat.isBlank()) {
            return "NONE";
        }
        String r = repeat.trim().toUpperCase();
        List<String> valid = List.of("NONE", "DAILY", "WEEKLY", "MONTHLY");
        return valid.contains(r) ? r : "NONE";
    }

    private static String normalizeOrNull(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }

    private Map<String, Object> parseDetail(String detail) {
        if (detail == null || detail.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(detail, new TypeReference<Map<String, Object>>() { });
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static List<Object> stringList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return new ArrayList<>(list);
        }
        return List.of();
    }

    private static List<Long> longList(Object value) {
        List<Object> raw = stringList(value);
        List<Long> out = new ArrayList<>();
        for (Object o : raw) {
            Long l = parseLong(String.valueOf(o));
            if (l != null) {
                out.add(l);
            }
        }
        return out;
    }

    private static Long parseLong(String raw) {
        try {
            return Long.parseLong(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static OffsetDateTime parseDate(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            java.time.LocalDate d = java.time.LocalDate.parse(value);
            return endOfDay ? d.atTime(23, 59, 59).atOffset(java.time.ZoneOffset.UTC)
                    : d.atStartOfDay().atOffset(java.time.ZoneOffset.UTC);
        } catch (Exception e) {
            return null;
        }
    }

    private static java.time.LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof java.time.LocalDate localDate) {
            return localDate;
        }
        return null;
    }

    private void saveAuditLog(User admin, String action, String entityType, Long entityId, String details) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setAdminId(admin.getId());
            auditLog.setAdminEmail(admin.getEmail());
            auditLog.setAction(action);
            auditLog.setEntityType(entityType);
            auditLog.setEntityId(entityId);
            auditLog.setDetails(details);
            auditLog.setIpAddress(AuditLogService.extractClientIp());
            auditLogRepository.save(auditLog);
        } catch (Exception ignored) {
            log.warn("Failed to save audit log", ignored);
        }
    }
}
