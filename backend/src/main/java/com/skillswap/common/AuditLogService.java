package com.skillswap.common;

import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public void log(String action, String resource, Long resourceId, String details, Long userId) {
        String ipAddress = extractClientIp();
        AuditLog auditLog = new AuditLog(action, resource, resourceId, details, userId, ipAddress);
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
        auditLogRepository.save(auditLog);
        log.info("Audit: {} on {} (id={}) by admin={} from {}", action, entityType, entityId, admin.getEmail(),
                auditLog.getIpAddress());
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

    /**
     * Resolves the originating client IP from the current request context,
     * honoring X-Forwarded-For (first entry) when present. Falls back to
     * "unknown" when no servlet request is active (e.g. background jobs).
     */
    public static String extractClientIp() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception e) {
            log.debug("Could not extract client IP", e);
        }
        return "unknown";
    }
}
