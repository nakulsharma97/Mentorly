package com.skillswap.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogService auditLogService;

    @AfterReturning("@annotation(auditableOperation)")
    public void auditOperation(JoinPoint joinPoint, AuditableOperation auditableOperation) {
        try {
            Long userId = extractUserId();
            Object result = null;

            Long resourceId = null;
            Object[] args = joinPoint.getArgs();
            if (args.length > 0) {
                resourceId = extractResourceId(args[0], auditableOperation.resourceIdField());
            }

            auditLogService.log(
                    auditableOperation.action(),
                    auditableOperation.resource(),
                    resourceId,
                    userId);
        } catch (Exception e) {
            log.error("Failed to audit operation: {}", joinPoint.getSignature(), e);
        }
    }

    private Long extractUserId() {
        try {
            Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principal instanceof com.skillswap.user.User user) {
                return user.getId();
            }
            if (principal instanceof org.springframework.security.core.userdetails.User springUser) {
                try {
                    return Long.parseLong(springUser.getUsername());
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract user ID from security context", e);
        }
        return null;
    }

    private Long extractResourceId(Object arg, String fieldName) {
        try {
            if (arg != null) {
                var field = arg.getClass().getDeclaredField(fieldName);
                field.setAccessible(true);
                Object value = field.get(arg);
                if (value instanceof Long) {
                    return (Long) value;
                } else if (value instanceof Integer) {
                    return ((Integer) value).longValue();
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract resource ID", e);
        }
        return null;
    }
}
