package com.skillswap.common;

import com.skillswap.admin.AdminSetting;
import com.skillswap.admin.AdminSettingRepository;
import com.skillswap.config.ClientIpResolver;
import com.skillswap.user.User;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service implementing audit log business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final AdminSettingRepository adminSettingRepository;
    private final ClientIpResolver clientIpResolver;
    private final SchedulerLockService schedulerLockService;

    /**
     * The injected resolver, mirrored to a static field so the widely-used
     * static {@link #extractClientIp()} helpers stay compatible with callers
     * outside this service. Set once at startup; the resolver itself is a
     * stateless read-only bean, so the mirror cannot go stale.
     */
    private static volatile ClientIpResolver resolver;

    @PostConstruct
    void init() {
        resolver = clientIpResolver;
    }

    // ── Severity constants ──
    public static final String SEV_INFO = "INFO";
    public static final String SEV_SUCCESS = "SUCCESS";
    public static final String SEV_WARNING = "WARNING";
    public static final String SEV_ERROR = "ERROR";
    public static final String SEV_CRITICAL = "CRITICAL";

    /** Admin settings key storing the audit retention policy (days). */
    public static final String SETTING_AUDIT_RETENTION_DAYS = "audit_retention_days";

    // ── Module constants ──
    public static final String MOD_AUTH = "AUTH";
    public static final String MOD_USER = "USER";
    public static final String MOD_SESSION = "SESSION";
    public static final String MOD_SKILL = "SKILL";
    public static final String MOD_REPORT = "REPORT";
    public static final String MOD_MODERATION = "MODERATION";
    public static final String MOD_PAYMENT = "PAYMENT";
    public static final String MOD_NOTIFICATION = "NOTIFICATION";
    public static final String MOD_ADMIN = "ADMIN";
    public static final String MOD_SYSTEM = "SYSTEM";
    public static final String MOD_SECURITY = "SECURITY";

    private static final Pattern OS_PATTERN = Pattern.compile(
            "(Windows NT [\\d.]+|Mac OS X [\\d_]+|Android [\\d.]+|iPhone OS [\\d_]+|Linux|iPad; CPU OS [\\d_]+)");
    private static final Pattern BROWSER_PATTERN = Pattern.compile(
            "(Chrome|Firefox|Safari|Edge|Opera|OPR|Edg|CriOS|FxiOS|MSIE|Trident)");
    private static final Pattern DEVICE_PATTERN = Pattern.compile(
            "(iPhone|iPad|Macintosh|Android|Windows|Linux)");

    public void log(String action, String resource, Long resourceId, String details, Long userId) {
        String ipAddress = extractClientIp();
        AuditLog auditLog = new AuditLog(action, resource, resourceId, details, userId, ipAddress);
        // The entity field initializers pre-set severity/outcome, so inference
        // must run explicitly here — otherwise every entry would read INFO/SUCCESS.
        auditLog.setSeverity(inferSeverity(action));
        auditLog.setModule(inferModule(action));
        enrichFromRequest(auditLog);
        auditLogRepository.save(auditLog);
        log.info("Audit: {} on {} (id={}) by user={} from {}", action, resource, resourceId, userId, ipAddress);
    }

    public void log(String action, String resource, Long resourceId, Long userId) {
        log(action, resource, resourceId, null, userId);
    }

    /**
     * Persists an admin-action audit entry using the admin audit fields
     * (admin_id / admin_email / entity_type / entity_id) plus the client IP
     * captured from the request context. The entry records who (admin), what
     * (action), which target (entityType#entityId), when (createdAt) and from
     * where (ipAddress) — the five fields surfaced on the Audit Logs page.
     */
    public void logAdmin(User admin, String action, String entityType, Long entityId, String details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setAdminId(admin.getId());
        auditLog.setAdminEmail(admin.getEmail());
        auditLog.setAction(action);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setDetails(details);
        auditLog.setIpAddress(extractClientIp());
        // Field initializers pre-set severity/outcome to INFO/SUCCESS, so infer
        // explicitly here (enrichFromRequest only fills null values).
        auditLog.setSeverity(inferSeverity(action));
        auditLog.setModule(inferModule(action));
        enrichFromRequest(auditLog);
        auditLogRepository.save(auditLog);
        log.info("Audit: {} on {} (id={}) by admin={} from {}", action, entityType, entityId, admin.getEmail(),
                auditLog.getIpAddress());
    }

    /**
     * Full-featured event logger for the activity timeline. Records severity,
     * module, outcome, before/after values and captures request metadata
     * (IP, user-agent → device/browser/OS, request id, endpoint) automatically.
     */
    @Transactional
    public AuditLog logEvent(String action, String module, String severity, String outcome,
            String entityType, Long entityId, String details,
            String beforeValue, String afterValue, Long userId) {
        AuditLog auditLog = new AuditLog();
        auditLog.setAction(action);
        auditLog.setModule(module == null ? inferModule(action) : module);
        auditLog.setSeverity(severity == null ? inferSeverity(action) : severity);
        auditLog.setOutcome(outcome == null ? "SUCCESS" : outcome);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setDetails(details);
        auditLog.setBeforeValue(beforeValue);
        auditLog.setAfterValue(afterValue);
        auditLog.setUserId(userId);
        auditLog.setIpAddress(extractClientIp());
        enrichFromRequest(auditLog);
        return auditLogRepository.save(auditLog);
    }

    /**
     * Event logger that lets the caller provide the acting admin user while
     * keeping all the activity-timeline metadata (used by admin-facing flows).
     */
    @Transactional
    public AuditLog logAdminEvent(User admin, String action, String module, String severity, String outcome,
            String entityType, Long entityId, String details, String beforeValue, String afterValue) {
        AuditLog auditLog = new AuditLog();
        auditLog.setAction(action);
        auditLog.setAdminId(admin == null ? null : admin.getId());
        auditLog.setAdminEmail(admin == null ? null : admin.getEmail());
        auditLog.setModule(module == null ? inferModule(action) : module);
        auditLog.setSeverity(severity == null ? inferSeverity(action) : severity);
        auditLog.setOutcome(outcome == null ? "SUCCESS" : outcome);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setDetails(details);
        auditLog.setBeforeValue(beforeValue);
        auditLog.setAfterValue(afterValue);
        auditLog.setIpAddress(extractClientIp());
        enrichFromRequest(auditLog);
        return auditLogRepository.save(auditLog);
    }

    /**
     * Background/system event logger with no HTTP request context (schedulers,
     * listeners). IP is left as "system".
     */
    @Transactional
    public AuditLog logSystemEvent(String action, String module, String severity, String details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setAction(action);
        auditLog.setModule(module == null ? MOD_SYSTEM : module);
        auditLog.setSeverity(severity == null ? SEV_INFO : severity);
        auditLog.setOutcome("SUCCESS");
        auditLog.setDetails(details);
        auditLog.setIpAddress("system");
        return auditLogRepository.save(auditLog);
    }

    public List<AuditLog> getAuditsByUser(Long userId) {
        return auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<AuditLog> getAuditsByAction(String action) {
        return auditLogRepository.findByActionOrderByCreatedAtDesc(action);
    }

    public List<AuditLog> getAuditsByResource(String resource, Long resourceId) {
        return auditLogRepository.findByResourceAndResourceIdOrderByCreatedAtDesc(resource, resourceId);
    }

    public List<AuditLog> getAuditsBetween(OffsetDateTime start, OffsetDateTime end) {
        return auditLogRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(start, end);
    }

    /** Best-effort severity inference from the action name. */
    public static String inferSeverity(String action) {
        if (action == null) {
            return SEV_INFO;
        }
        String a = action.toUpperCase();
        if (a.contains("DELETE") || a.contains("SUSPEND") || a.contains("FAILED")
                || a.contains("ERROR") || a.contains("CRITICAL") || a.contains("BLOCK")
                || a.contains("REFUND") || a.contains("RESET_ALL")) {
            return SEV_CRITICAL;
        }
        if (a.contains("DISABLE") || a.contains("REJECT") || a.contains("REMOVE")
                || a.contains("WARN") || a.contains("CANCEL") || a.contains("DENY")
                || a.contains("REVOKE")) {
            return SEV_WARNING;
        }
        if (a.contains("APPROVE") || a.contains("VERIFY") || a.contains("ENABLE")
                || a.contains("COMPLETE") || a.contains("RELEASE") || a.contains("RESTORE")) {
            return SEV_SUCCESS;
        }
        return SEV_INFO;
    }

    /** Best-effort module inference from the action name. */
    public static String inferModule(String action) {
        if (action == null) {
            return MOD_SYSTEM;
        }
        String a = action.toUpperCase();
        if (a.contains("LOGIN") || a.contains("LOGOUT") || a.contains("PASSWORD") || a.contains("SIGNUP")
                || a.contains("OAUTH") || a.contains("REFRESH")) {
            return MOD_AUTH;
        }
        if (a.contains("USER") || a.contains("ROLE") || a.contains("PROFILE")) {
            return MOD_USER;
        }
        if (a.contains("SESSION") || a.contains("BOOKING")) {
            return MOD_SESSION;
        }
        if (a.contains("SKILL") || a.contains("CERTIF")) {
            return MOD_SKILL;
        }
        if (a.contains("REPORT")) {
            return MOD_REPORT;
        }
        if (a.contains("MODERAT") || a.contains("FLAGGED") || a.contains("WARN_USER")) {
            return MOD_MODERATION;
        }
        if (a.contains("PAYMENT") || a.contains("WALLET") || a.contains("REFUND")
                || a.contains("ESCROW") || a.contains("RELEASE")) {
            return MOD_PAYMENT;
        }
        if (a.contains("NOTIF") || a.contains("BROADCAST") || a.contains("EMAIL")) {
            return MOD_NOTIFICATION;
        }
        if (a.contains("SETTINGS") || a.contains("CONFIG") || a.contains("RESET_ALL")) {
            return MOD_ADMIN;
        }
        if (a.contains("FAILED") || a.contains("SECURITY") || a.contains("ATTEMPT")) {
            return MOD_SECURITY;
        }
        return MOD_SYSTEM;
    }

    /**
     * Applies V47 metadata: severity + module inference, plus request-derived
     * values (user-agent → device/browser/OS, request id, endpoint). Only fills
     * fields that are still null so callers can override the inference.
     */
    private static void enrichFromRequest(AuditLog auditLog) {
        inferMetadata(auditLog);
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attributes == null) {
                return;
            }
            HttpServletRequest request = attributes.getRequest();

            if (auditLog.getIpAddress() == null) {
                auditLog.setIpAddress(extractClientIp(request));
            }
            if (auditLog.getRequestId() == null) {
                String reqId = request.getHeader("X-Request-Id");
                auditLog.setRequestId(reqId != null && !reqId.isBlank() ? reqId
                        : UUID.randomUUID().toString().substring(0, 12));
            }
            if (auditLog.getCorrelationId() == null) {
                String corrId = request.getHeader("X-Correlation-Id");
                auditLog.setCorrelationId(corrId != null && !corrId.isBlank() ? corrId
                        : UUID.randomUUID().toString().substring(0, 12));
            }
            if (auditLog.getEndpoint() == null) {
                auditLog.setEndpoint(request.getMethod() + " " + request.getRequestURI());
            }
            if (auditLog.getUserAgent() == null) {
                String ua = request.getHeader("User-Agent");
                auditLog.setUserAgent(ua != null && ua.length() > 255 ? ua.substring(0, 255) : ua);
                parseUserAgent(auditLog, ua);
            }
        } catch (Exception e) {
            log.debug("Could not enrich audit log with request metadata", e);
        }
    }

    private static void inferMetadata(AuditLog auditLog) {
        if (auditLog.getSeverity() == null) {
            auditLog.setSeverity(inferSeverity(auditLog.getAction()));
        }
        if (auditLog.getModule() == null) {
            auditLog.setModule(inferModule(auditLog.getAction()));
        }
        if (auditLog.getOutcome() == null) {
            auditLog.setOutcome("SUCCESS");
        }
    }

    /** Lightweight User-Agent parser — fills device, browser and os on the entry. */
    static void parseUserAgent(AuditLog auditLog, String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return;
        }
        try {
            Matcher m;
            m = OS_PATTERN.matcher(userAgent);
            if (m.find()) {
                auditLog.setOs(m.group(1).replace('_', '.'));
            }
            m = BROWSER_PATTERN.matcher(userAgent);
            if (m.find()) {
                String b = m.group(1);
                String browser = switch (b) {
                    case "Edg", "Edge" -> "Edge";
                    case "OPR" -> "Opera";
                    case "CriOS" -> "Chrome (iOS)";
                    case "FxiOS" -> "Firefox (iOS)";
                    case "MSIE", "Trident" -> "Internet Explorer";
                    default -> b;
                };
                auditLog.setBrowser(browser);
            }
            m = DEVICE_PATTERN.matcher(userAgent);
            if (m.find()) {
                String d = m.group(1);
                String device = switch (d) {
                    case "iPhone" -> "Phone";
                    case "iPad" -> "Tablet";
                    case "Macintosh" -> "Desktop";
                    case "Android" -> userAgent.contains("Mobile") ? "Phone" : "Tablet";
                    case "Windows" -> "Desktop";
                    case "Linux" -> "Desktop";
                    default -> d;
                };
                auditLog.setDevice(device);
            }
        } catch (Exception e) {
            log.debug("Could not parse user agent", e);
        }
    }

    /**
     * Resolves the originating client IP from the current request context,
     * delegating to {@link ClientIpResolver} so spoofable forwarded headers are
     * only honored when the deployment is behind a trusted proxy. Falls back
     * to "unknown" when no servlet request is active (e.g. background jobs).
     */
    public static String extractClientIp() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attributes != null) {
                return extractClientIp(attributes.getRequest());
            }
        } catch (Exception e) {
            log.debug("Could not extract client IP", e);
        }
        return "unknown";
    }

    private static String extractClientIp(HttpServletRequest request) {
        try {
            ClientIpResolver current = resolver;
            if (current != null) {
                return current.resolve(request);
            }
            // Resolver not wired yet (e.g. direct construction in tests):
            // never trust forwarded headers in that case.
            return request.getRemoteAddr();
        } catch (Exception e) {
            return "unknown";
        }
    }

    // ── Retention ──────────────────────────────────────────────────

    /**
     * Purges un-archived entries older than the retention cutoff. Used by the
     * admin retention endpoint and the nightly scheduler.
     *
     * @return number of rows removed
     */
    @Transactional
    public int purgeOlderThan(OffsetDateTime cutoff) {
        int removed = auditLogRepository.purgeOlderThan(cutoff);
        log.info("Audit retention: purged {} entries older than {}", removed, cutoff);
        return removed;
    }

    /**
     * Nightly retention sweep — purges expired audit entries using the
     * admin-configured policy (key {@code audit_retention_days}, default 365).
     */
    @Scheduled(cron = "0 15 3 * * *")
    public void nightlyRetentionPurge() {
        // Leader lock so only one instance (k8s replica) runs the retention sweep.
        schedulerLockService.runIfLeader("audit-retention-purge", () -> {
            try {
                int days = configuredRetentionDays();
                OffsetDateTime cutoff = OffsetDateTime.now().minusDays(days);
                int removed = auditLogRepository.purgeOlderThan(cutoff);
                if (removed > 0) {
                    log.info("Nightly audit retention: purged {} entries older than {} days", removed, days);
                }
            } catch (Exception e) {
                log.warn("Nightly audit retention purge failed", e);
            }
        });
    }

    /**
     * Reads the admin-configured audit retention policy in days (default 365).
     * Single source of truth for the retention cutoff — the admin controller
     * delegates here so the policy never drifts between the purge endpoint and
     * the nightly sweep.
     */
    public int configuredRetentionDays() {
        try {
            return adminSettingRepository.findBySettingKey(SETTING_AUDIT_RETENTION_DAYS)
                    .map(AdminSetting::getSettingValue)
                    .map(v -> Math.max(1, Math.min(3650, Integer.parseInt(v.trim()))))
                    .orElse(365);
        } catch (Exception e) {
            return 365;
        }
    }
}
