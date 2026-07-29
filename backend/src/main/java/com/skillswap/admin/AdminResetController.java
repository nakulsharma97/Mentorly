package com.skillswap.admin;

import com.skillswap.common.AdminUtils;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin endpoint to completely reset all user-generated data in the database.
 * This is a destructive operation that deletes all users, sessions, bookings,
 * payments, messages, reviews, notifications, and uploaded files while preserving
 * the database schema, system configuration, and skill definitions.
 *
 * Access: Restricted to ADMIN role.
 */
@RestController
@RequestMapping("/api/v1/admin/reset")
@RequiredArgsConstructor
public class AdminResetController {

    private static final Logger log = LoggerFactory.getLogger(AdminResetController.class);

    private final AdminResetService adminResetService;
    private final AuditLogRepository auditLogRepository;

    /**
     * Deletes ALL user-generated data from the database and clears uploaded files.
     * Preserves: schema, admin_settings, admin_notif_preferences, skills.
     *
     * @return summary of the cleanup operation
     */
    @PostMapping
    public ApiResponse<Map<String, Object>> resetAllData(
            @AuthenticationPrincipal User currentUser) {
        AdminUtils.ensureAdmin(currentUser);

        log.warn("Admin {} ({}) initiated a full database reset!", currentUser.getEmail(), currentUser.getId());

        AdminResetService.CleanupResult result = adminResetService.resetAllData();

        saveAuditLog(currentUser, "RESET_ALL_DATA", result);

        log.warn("Database reset completed by admin {}: {}", currentUser.getEmail(), result.summary());

        return new ApiResponse<>("Database reset complete. All user-generated data has been deleted.",
                Map.of(
                        "rowsDeleted", result.rowsDeleted(),
                        "tablesCleared", result.tablesCleared(),
                        "uploadedFilesRemoved", result.uploadedFilesRemoved(),
                        "summary", result.summary()));
    }

    private void saveAuditLog(User admin, String action, AdminResetService.CleanupResult result) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setAdminId(admin.getId());
            auditLog.setAdminEmail(admin.getEmail());
            auditLog.setAction(action);
            auditLog.setEntityType("Database");
            auditLog.setDetails(result.summary());
            auditLogRepository.save(auditLog);
        } catch (Exception ignored) {
            log.warn("Failed to save audit log for reset operation", ignored);
        }
    }
}
