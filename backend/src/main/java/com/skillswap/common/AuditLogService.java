package com.skillswap.common;

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

    private String extractClientIp() {
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
