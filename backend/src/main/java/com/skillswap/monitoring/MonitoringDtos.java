package com.skillswap.monitoring;

import java.util.List;

/** DTO records for the admin platform-health monitoring dashboard. */
public final class MonitoringDtos {

    private MonitoringDtos() {
    }

    // ── Top-level payload (keeps legacy field names so the previous UI contract holds) ──

    public record AdminHealthDto(
            String status,
            String overallStatus,
            String uptime,
            String memoryUsage,
            double memoryUsagePercent,
            long errors24h,
            long totalUsers,
            long totalBookings,
            long pendingReports,
            String serverTime,
            SystemMetricsDto system,
            DatabaseHealthDto database,
            ApiMonitoringDto api,
            List<MicroserviceHealthDto> services,
            QueueHealthDto queues,
            SecurityMetricsDto security,
            ErrorMetricsDto errors,
            ActivityMetricsDto activity,
            List<AlertDto> alerts,
            List<NamedChartDto> charts,
            List<LogBufferService.LogEntry> logs,
            long totalLogs) {}

    // ── System (JVM) metrics ──

    public record SystemMetricsDto(
            long uptimeSeconds,
            String uptimeLabel,
            double cpuPercent,
            double systemLoadAverage,
            long heapUsedMb,
            long heapMaxMb,
            double heapPercent,
            long nonHeapMb,
            long memoryUsedMb,
            long memoryMaxMb,
            double memoryPercent,
            long diskTotalMb,
            long diskUsableMb,
            double diskPercent,
            int threadCount,
            String jvmVersion,
            String javaVersion,
            String os,
            String timezone,
            String serverTime,
            String appVersion) {}

    // ── Database health ──

    public record DatabaseHealthDto(
            String status,
            double responseTimeMs,
            int activeConnections,
            int idleConnections,
            int totalConnections,
            int waitingConnections,
            double poolUsagePercent,
            int poolMax,
            long slowQueries,
            long connectionErrors,
            double dbSizeMb,
            String driver) {}

    // ── API monitoring ──

    public record ApiMonitoringDto(
            int totalApis,
            long totalRequests,
            long failedRequests,
            double successRate,
            double avgResponseTimeMs,
            String slowestEndpoint,
            double slowestEndpointMs,
            String mostRequestedEndpoint,
            long mostRequestedCount,
            long failedToday) {}

    // ── Microservice (logical module) health ──

    public record MicroserviceHealthDto(
            String name,
            String status,
            double latencyMs,
            String uptime,
            String version) {}

    // ── Queues ──

    public record QueueHealthDto(
            long notificationQueue,
            long emailQueue,
            long backgroundJobs,
            long retryQueue,
            long failedJobs,
            long pendingJobs) {}

    // ── Security monitoring ──

    public record SecurityMetricsDto(
            long failedLogins24h,
            long blockedUsers,
            long suspiciousRequests24h,
            long jwtValidationErrors24h,
            long unauthorizedRequests24h,
            long securityEvents24h) {}

    // ── Error monitoring ──

    public record ErrorMetricsDto(
            long errorsToday,
            long criticalErrors24h,
            long warnings24h,
            long exceptions24h,
            List<LogBufferService.LogEntry> recentStackTraces,
            List<NamedChartDto> trend) {}

    // ── Activity monitoring ──

    public record ActivityMetricsDto(
            long usersOnline,
            long mentorsOnline,
            long learnersOnline,
            long activeSessions,
            long loginsToday,
            long registrationsToday,
            long bookingsToday) {}

    // ── Alerts (threshold derived) ──

    public record AlertDto(String severity, String title, String message) {}

    // ── Chart series (real sampled / aggregated data) ──

    /** One point of a named chart series. */
    public record ChartSeriesDto(String label, long value) {}

    /** A named chart (e.g. cpu, memory, apiResponse, dbResponse, userActivity, errorTrend). */
    public record NamedChartDto(String key, String label, List<ChartSeriesDto> points) {}
}
