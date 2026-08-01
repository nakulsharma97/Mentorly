package com.skillswap.common;

import com.skillswap.admin.AdminSetting;
import com.skillswap.admin.AdminSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuditLogServiceTest {

    private AuditLogRepository auditLogRepository;
    private AdminSettingRepository adminSettingRepository;
    private AuditLogService auditLogService;

    @BeforeEach
    void setUp() {
        auditLogRepository = mock(AuditLogRepository.class);
        adminSettingRepository = mock(AdminSettingRepository.class);
        auditLogService = new AuditLogService(auditLogRepository, adminSettingRepository);
    }

    private void stubRetentionSetting(String rawValue) {
        AdminSetting setting = new AdminSetting();
        setting.setSettingKey(AuditLogService.SETTING_AUDIT_RETENTION_DAYS);
        setting.setSettingValue(rawValue);
        when(adminSettingRepository.findBySettingKey(eq(AuditLogService.SETTING_AUDIT_RETENTION_DAYS)))
                .thenReturn(Optional.of(setting));
    }

    @Test
    void configuredRetentionDays_readsConfiguredValue() {
        stubRetentionSetting("90");
        assertEquals(90, auditLogService.configuredRetentionDays());
    }

    @Test
    void configuredRetentionDays_clampsToMax3650() {
        stubRetentionSetting("5000");
        assertEquals(3650, auditLogService.configuredRetentionDays());
    }

    @Test
    void configuredRetentionDays_clampsToMin1() {
        stubRetentionSetting("0");
        assertEquals(1, auditLogService.configuredRetentionDays());
    }

    @Test
    void configuredRetentionDays_defaultsTo365_whenUnset() {
        when(adminSettingRepository.findBySettingKey(eq(AuditLogService.SETTING_AUDIT_RETENTION_DAYS)))
                .thenReturn(Optional.empty());
        assertEquals(365, auditLogService.configuredRetentionDays());
    }

    @Test
    void configuredRetentionDays_defaultsTo365_whenValueIsMalformed() {
        stubRetentionSetting("not-a-number");
        assertEquals(365, auditLogService.configuredRetentionDays());
    }
}
