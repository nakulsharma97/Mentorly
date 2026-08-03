package com.skillswap.monitoring;

import java.util.List;

/**
 * Encapsulates monitoring dtos.
 */
public final class MonitoringDtos {

    private MonitoringDtos() {
    }

    // ── Top-level payload (keeps legacy field names so the previous UI contract holds) ──

/**
 * Immutable data carrier for admin health.
 */
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
            long totalLogs) { }

    // ── System (JVM) metrics ──

/**
 * Immutable data carrier for system metrics.
 */
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
            String appVersion) { }

    // ── Database health ──

/**
 * Immutable data carrier for database health.
 */
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
            String driver) { }

    // ── API monitoring ──

/**
 * Immutable data carrier for api monitoring.
 */
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
            long failedToday) { }

    // ── Microservice (logical module) health ──

/**
 * Immutable data carrier for microservice health.
 */
    public record MicroserviceHealthDto(
            String name,
            String status,
            double latencyMs,
            String uptime,
            String version) { }

    // ── Queues ──

/**
 * Immutable data carrier for queue health.
 */
    public record QueueHealthDto(
            long notificationQueue,
            long emailQueue,
            long backgroundJobs,
            long retryQueue,
            long failedJobs,
            long pendingJobs) { }

    // ── Security monitoring ──

/**
 * Immutable data carrier for security metrics.
 */
    public record SecurityMetricsDto(
            long failedLogins24h,
            long blockedUsers,
            long suspiciousRequests24h,
            long jwtValidationErrors24h,
            long unauthorizedRequests24h,
            long securityEvents24h) { }

    // ── Error monitoring ──

/**
 * Immutable data carrier for error metrics.
 */
    public record ErrorMetricsDto(
            long errorsToday,
            long criticalErrors24h,
            long warnings24h,
            long exceptions24h,
            List<LogBufferService.LogEntry> recentStackTraces,
            List<NamedChartDto> trend) { }

    // ── Activity monitoring ──

/**
 * Immutable data carrier for activity metrics.
 */
    public record ActivityMetricsDto(
            long usersOnline,
            long mentorsOnline,
            long learnersOnline,
            long activeSessions,
            long loginsToday,
            long registrationsToday,
            long bookingsToday) { }

    // ── Alerts (threshold derived) ──

/**
 * Immutable data carrier for alert.
 */
    public record AlertDto(String severity, String title, String message) { }

    // ── Chart series (real sampled / aggregated data) ──

/**
 * Immutable data carrier for chart series.
 */
    public record ChartSeriesDto(String label, long value) { }

/**
 * Immutable data carrier for named chart.
 */
    public record NamedChartDto(String key, String label, List<ChartSeriesDto> points) { }
}
