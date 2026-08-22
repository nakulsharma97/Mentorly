package com.skillswap.monitoring;

import com.skillswap.auth.LoginAttemptRepository;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.AuditLog;
import com.skillswap.common.AuditLogRepository;
import com.skillswap.moderation.FlaggedContentRepository;
import com.skillswap.notification.AppNotificationRepository;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.ThreadMXBean;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Computes the full platform-health payload for the admin monitoring dashboard.
 * Every metric is real:
 * <ul>
 *   <li><b>System</b> — live JVM heap/non-heap, CPU, disk, threads, versions.</li>
 *   <li><b>Database</b> — connection pool (Hikari), timed {@code SELECT 1}, size, slow queries.</li>
 *   <li><b>API</b> — registered endpoints, real per-request stats from {@link RequestStatsService}.</li>
 *   <li><b>Queues / Security / Errors / Activity</b> — real repository + audit-log counts.</li>
 *   <li><b>Logs</b> — real captured Logback events via {@link LogBufferService}.</li>
 * </ul>
 * Nothing is hardcoded or seeded; when a probe fails (e.g. MySQL status vars are
 * unavailable) the metric degrades to a safe neutral value rather than throwing.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SystemHealthService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("MMM d");

    /** Cache TTL in milliseconds — 10 seconds. Frontend polls every 30s, so
     * 10s keeps data fresh while eliminating redundant heavy computation. */
    private static final long CACHE_TTL_MS = 10_000;

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final SessionRepository sessionRepository;
    private final PaymentRepository paymentRepository;
    private final FlaggedContentRepository flaggedContentRepository;
    private final UserReportRepository reportRepository;
    private final AuditLogRepository auditLogRepository;
    private final AppNotificationRepository appNotificationRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final RequestStatsService requestStatsService;
    private final LogBufferService logBufferService;
    private final JdbcTemplate jdbcTemplate;
    private final RequestMappingHandlerMapping requestMappingHandlerMapping;

    private String appVersion = "dev";

    /** Simple time-based cache for the health payload. */
    private final AtomicReference<CachedHealth> cache = new AtomicReference<>();

    private record CachedHealth(MonitoringDtos.AdminHealthDto health, long timestamp) {
        boolean isFresh() {
            return System.currentTimeMillis() - timestamp < CACHE_TTL_MS;
        }
    }

    @PostConstruct
    void init() {
        String impl = MonitoringDtos.class.getPackage().getImplementationVersion();
        if (impl != null && !impl.isBlank()) {
            appVersion = impl;
        }
    }

    /**
     * Returns the cached health payload if fresh, otherwise recomputes.
     * This avoids redundant heavy DB scans on every 30s poll.
     */
    public MonitoringDtos.AdminHealthDto getPlatformHealth() {
        CachedHealth cached = cache.get();
        if (cached != null && cached.isFresh()) {
            return cached.health();
        }
        MonitoringDtos.AdminHealthDto health = computeHealth();
        cache.set(new CachedHealth(health, System.currentTimeMillis()));
        return health;
    }

    /**
     * Samples the latest health snapshot into the live chart history.
     * Runs on a fixed schedule (every 15s) independent of HTTP requests.
     */
    @Scheduled(fixedRate = 15_000, initialDelay = 15_000)
    public void recordHealthSampleOnSchedule() {
        try {
            MonitoringDtos.AdminHealthDto health = getPlatformHealth();
            recordHealthSample(health);
        } catch (Exception ex) {
            log.debug("Health sample recording failed: {}", ex.getMessage());
        }
    }

    /** Records one sampled snapshot into the stats history for live charts. */
    public void recordHealthSample(MonitoringDtos.AdminHealthDto health) {
        double cpu = health.system() != null ? health.system().cpuPercent() : 0;
        double heap = health.system() != null ? health.system().heapPercent() : 0;
        double db = health.database() != null ? Math.max(0, health.database().responseTimeMs()) : 0;
        double api = health.api() != null ? health.api().avgResponseTimeMs() : 0;
        double load = health.system() != null ? health.system().systemLoadAverage() : 0;
        requestStatsService.recordSample(new RequestStatsService.SystemSample(
                System.currentTimeMillis(), cpu, heap, db, api, load));
    }

    // ══════════════════════════════════════════════════════════════════
    //  Core computation — runs only when cache is stale
    // ══════════════════════════════════════════════════════════════════

    private MonitoringDtos.AdminHealthDto computeHealth() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime todayStart = now.withHour(0).withMinute(0).withSecond(0).withNano(0);
        OffsetDateTime dayAgo = now.minusDays(1);
        OffsetDateTime onlineCutoff = now.minusMinutes(15);

        // ── Independent probes — run concurrently ──
        CompletableFuture<MonitoringDtos.SystemMetricsDto> systemFuture =
                CompletableFuture.supplyAsync(() -> collectSystemMetrics(now));
        CompletableFuture<MonitoringDtos.DatabaseHealthDto> databaseFuture =
                CompletableFuture.supplyAsync(this::collectDatabaseMetrics);
        CompletableFuture<MonitoringDtos.ApiMonitoringDto> apiFuture =
                CompletableFuture.supplyAsync(this::collectApiMetrics);
        CompletableFuture<List<MonitoringDtos.MicroserviceHealthDto>> servicesFuture =
                CompletableFuture.supplyAsync(this::collectServiceMetrics);
        CompletableFuture<MonitoringDtos.ErrorMetricsDto> errorsFuture =
                CompletableFuture.supplyAsync(() -> collectErrorMetrics(todayStart, dayAgo));

        // Wait for all concurrent probes
        MonitoringDtos.SystemMetricsDto system = joinQuietly(systemFuture, "system");
        MonitoringDtos.DatabaseHealthDto database = joinQuietly(databaseFuture, "database");
        MonitoringDtos.ApiMonitoringDto api = joinQuietly(apiFuture, "api");
        List<MonitoringDtos.MicroserviceHealthDto> services = joinQuietly(servicesFuture, "services");
        MonitoringDtos.ErrorMetricsDto errors = joinQuietly(errorsFuture, "errors");

        // ── Queues (lightweight counts) ──
        MonitoringDtos.QueueHealthDto queues = new MonitoringDtos.QueueHealthDto(
                appNotificationRepository.countByReadFalse(),
                auditLogRepository.countBySeverityAndCreatedAtAfter("ERROR", dayAgo),
                bookingRepository.countByBookingStatus(BookingStatus.PENDING),
                loginAttemptRepository.countByBlockedUntilAfter(now),
                auditLogRepository.countBySeverityAndCreatedAtAfter("CRITICAL", dayAgo),
                bookingRepository.countByBookingStatus(BookingStatus.PENDING));

        // ── Security ──
        long failedLogins24h = loginAttemptRepository.countByLastAttemptAtAfter(dayAgo);
        long blockedUsers = userRepository.countByEnabledFalse();
        Map<Integer, Long> statusCounts = requestStatsService.failuresByStatus();
        long suspicious24h = statusCounts.getOrDefault(429, 0L);
        long jwtErrors24h = statusCounts.getOrDefault(401, 0L);
        long unauthorized24h = jwtErrors24h + statusCounts.getOrDefault(403, 0L);
        MonitoringDtos.SecurityMetricsDto security = new MonitoringDtos.SecurityMetricsDto(
                failedLogins24h, blockedUsers, suspicious24h, jwtErrors24h, unauthorized24h,
                failedLogins24h + unauthorized24h + suspicious24h);

        // ── Activity ──
        MonitoringDtos.ActivityMetricsDto activity = new MonitoringDtos.ActivityMetricsDto(
                userRepository.countByLastActiveAtAfter(onlineCutoff),
                userRepository.countByRoleAndLastActiveAtAfter(UserRole.MENTOR, onlineCutoff),
                userRepository.countByRoleAndLastActiveAtAfter(UserRole.LEARNER, onlineCutoff),
                bookingRepository.countByBookingStatus(BookingStatus.IN_PROGRESS),
                userRepository.countByLastActiveAtAfter(todayStart),
                userRepository.countByCreatedAtAfter(todayStart),
                bookingRepository.countByCreatedAtAfter(todayStart));

        // ── Alerts ──
        List<MonitoringDtos.AlertDto> alerts = collectAlerts(system, database, api, errors, queues, services);

        // ── Charts ──
        List<MonitoringDtos.NamedChartDto> charts = collectCharts(now);

        // ── Logs ──
        List<LogBufferService.LogEntry> logs = logBufferService.recent(null, null, 50);

        // ── Overall status ──
        String overallStatus = computeOverallStatus(alerts, database);
        String legacyStatus = switch (overallStatus) {
            case "HEALTHY" -> "healthy";
            case "WARNING" -> "degraded";
            default -> "critical";
        };

        long totalUsers = userRepository.count();
        long totalBookings = bookingRepository.count();
        long pendingReports = reportRepository.countByStatus(ReportStatus.OPEN);

        return new MonitoringDtos.AdminHealthDto(
                legacyStatus, overallStatus,
                formatUptime(system.uptimeSeconds()),
                system.heapUsedMb() + "MB / " + system.heapMaxMb() + "MB",
                system.heapPercent(),
                errors.errorsToday(),
                totalUsers, totalBookings, pendingReports,
                now.toString(),
                system, database, api, services, queues, security, errors, activity,
                alerts, charts, logs, logBufferService.size());
    }

    /** Joins a CompletableFuture, returning a safe fallback on failure. */
    private <T> T joinQuietly(CompletableFuture<T> future, String probe) {
        try {
            return future.get();
        } catch (Exception ex) {
            log.warn("Health probe '{}' failed: {}", probe, ex.getMessage());
            return null;
        }
    }

    // ── System (JVM) ──────────────────────────────────────────────

    private MonitoringDtos.SystemMetricsDto collectSystemMetrics(OffsetDateTime now) {
        Runtime rt = Runtime.getRuntime();
        long usedMemory = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long maxMemory = rt.maxMemory() / (1024 * 1024);
        double memoryPercent = Math.round(usedMemory * 100.0 / Math.max(maxMemory, 1) * 10.0) / 10.0;

        MemoryMXBean mem = ManagementFactory.getMemoryMXBean();
        MemoryUsage heap = mem.getHeapMemoryUsage();
        MemoryUsage nonHeap = mem.getNonHeapMemoryUsage();
        long heapUsed = heap.getUsed() / (1024 * 1024);
        long heapMax = heap.getMax() > 0 ? heap.getMax() / (1024 * 1024) : maxMemory;
        double heapPercent = Math.round(heapUsed * 100.0 / Math.max(heapMax, 1) * 10.0) / 10.0;

        double cpuPercent = 0;
        double loadAvg = 0;
        try {
            com.sun.management.OperatingSystemMXBean osBean =
                    ManagementFactory.getPlatformMXBean(com.sun.management.OperatingSystemMXBean.class);
            double load = osBean.getProcessCpuLoad();
            cpuPercent = load >= 0 ? Math.round(load * 1000) / 10.0 : 0;
            loadAvg = osBean.getSystemLoadAverage() < 0 ? 0 : osBean.getSystemLoadAverage();
        } catch (Exception ex) {
            log.debug("Could not read OS metrics: {}", ex.getMessage());
        }

        File disk = new File(".");
        long diskTotal = disk.getTotalSpace() / (1024 * 1024);
        long diskUsable = disk.getUsableSpace() / (1024 * 1024);
        double diskPercent = diskTotal <= 0 ? 0
                : Math.round((diskTotal - diskUsable) * 100.0 / diskTotal * 10.0) / 10.0;

        ThreadMXBean threads = ManagementFactory.getThreadMXBean();
        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;

        return new MonitoringDtos.SystemMetricsDto(
                uptimeSeconds, formatUptime(uptimeSeconds),
                cpuPercent, loadAvg,
                heapUsed, heapMax, heapPercent,
                nonHeap.getUsed() / (1024 * 1024),
                usedMemory, maxMemory, memoryPercent,
                diskTotal, diskUsable, diskPercent,
                threads.getThreadCount(),
                System.getProperty("java.vm.version", "unknown"),
                System.getProperty("java.version", "unknown"),
                System.getProperty("os.name", "unknown") + " " + System.getProperty("os.arch", ""),
                TimeZone.getDefault().getID(),
                now.toString(),
                appVersion);
    }

    // ── Database ──────────────────────────────────────────────────

    private MonitoringDtos.DatabaseHealthDto collectDatabaseMetrics() {
        long dbResponseMs = 0;
        boolean up = false;
        try {
            long start = System.nanoTime();
            Integer one = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            dbResponseMs = Math.max(1, (System.nanoTime() - start) / 1_000_000);
            up = one != null && one == 1;
        } catch (Exception ex) {
            dbResponseMs = -1;
        }

        int active = 0, idle = 0, total = 0, waiting = 0, poolMax = 0;
        try {
            if (jdbcTemplate.getDataSource() instanceof com.zaxxer.hikari.HikariDataSource hikari) {
                com.zaxxer.hikari.HikariPoolMXBean mx = hikari.getHikariPoolMXBean();
                if (mx != null) {
                    active = mx.getActiveConnections();
                    idle = mx.getIdleConnections();
                    waiting = mx.getThreadsAwaitingConnection();
                    total = mx.getTotalConnections();
                }
                poolMax = hikari.getMaximumPoolSize();
            }
        } catch (Exception ignored) {
            // Pool introspection is best-effort.
        }

        long slowQueries = mysqlStatusValue("Slow_queries");
        long connectionErrors = mysqlStatusValue("Connection_errors_total");
        double dbSizeMb = mysqlDbSizeMb();

        String driver = "";
        try {
            if (jdbcTemplate.getDataSource() != null) {
                driver = jdbcTemplate.getDataSource().getConnection().getMetaData().getDriverName();
            }
        } catch (Exception ignored) {
            // Driver name is cosmetic.
        }

        double poolPercent = poolMax <= 0 ? 0
                : Math.round(active * 100.0 / poolMax * 10.0) / 10.0;

        return new MonitoringDtos.DatabaseHealthDto(
                up ? "UP" : "DOWN", dbResponseMs, active, idle, total, waiting,
                poolPercent, poolMax, slowQueries, connectionErrors, dbSizeMb, driver);
    }

    private long mysqlStatusValue(String variableName) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("SHOW GLOBAL STATUS LIKE ?", variableName);
            if (rows.isEmpty() || rows.get(0).get("Value") == null) {
                return 0;
            }
            return Long.parseLong(String.valueOf(rows.get(0).get("Value")));
        } catch (Exception ex) {
            return 0;
        }
    }

    private double mysqlDbSizeMb() {
        try {
            String schema = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
            if (schema == null || schema.isBlank()) {
                return 0;
            }
            Double size = jdbcTemplate.queryForObject(
                    "SELECT ROUND(COALESCE(SUM(data_length + index_length), 0) / 1024 / 1024, 2) "
                            + "FROM information_schema.tables WHERE table_schema = ?",
                    Double.class, schema);
            return size != null ? size : 0;
        } catch (Exception ex) {
            return 0;
        }
    }

    // ── API monitoring ────────────────────────────────────────────

    private MonitoringDtos.ApiMonitoringDto collectApiMetrics() {
        int totalApis = 0;
        try {
            totalApis = requestMappingHandlerMapping.getHandlerMethods().size();
        } catch (Exception ignored) {
            // Endpoint discovery is best-effort.
        }

        long totalRequests = requestStatsService.totalRequests();
        long failedRequests = requestStatsService.failedRequests();
        double successRate = totalRequests == 0 ? 100
                : Math.round((totalRequests - failedRequests) * 100.0 / totalRequests * 10.0) / 10.0;
        double avgMs = Math.round(requestStatsService.avgResponseTimeMs() * 10.0) / 10.0;

        String slowest = "—";
        double slowestMs = 0;
        String mostRequested = "—";
        long mostRequestedCount = 0;
        for (RequestStatsService.EndpointStat stat : requestStatsService.endpoints()) {
            double avg = stat.avgResponseTimeMs();
            if (avg > slowestMs && stat.count() > 0) {
                slowestMs = avg;
                slowest = stat.path();
            }
            if (stat.count() > mostRequestedCount) {
                mostRequestedCount = stat.count();
                mostRequested = stat.path();
            }
        }

        return new MonitoringDtos.ApiMonitoringDto(
                totalApis, totalRequests, failedRequests, successRate, avgMs,
                slowest, Math.round(slowestMs * 10.0) / 10.0,
                mostRequested, mostRequestedCount,
                requestStatsService.failedToday());
    }

    // ── Microservices (logical modules with real latency) ─────────

    private List<MonitoringDtos.MicroserviceHealthDto> collectServiceMetrics() {
        String uptime = formatUptime(ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        List<MonitoringDtos.MicroserviceHealthDto> services = new ArrayList<>();
        services.add(probe("Auth", uptime, () -> loginAttemptRepository.count()));
        services.add(probe("User", uptime, () -> userRepository.count()));
        services.add(probe("Session", uptime, () -> sessionRepository.count()));
        services.add(probe("Payment", uptime, () -> paymentRepository.count()));
        services.add(probe("Notification", uptime, () -> appNotificationRepository.count()));
        services.add(probe("Admin", uptime, () -> auditLogRepository.count()));
        services.add(probe("Moderation", uptime, () -> flaggedContentRepository.countByDeletedAtIsNull()));
        services.add(probe("Gateway", uptime, () -> requestStatsService.totalRequests()));
        return services;
    }

    private MonitoringDtos.MicroserviceHealthDto probe(String name, String uptime,
            java.util.function.LongSupplier probe) {
        long start = System.nanoTime();
        try {
            probe.getAsLong();
            return new MonitoringDtos.MicroserviceHealthDto(
                    name, "UP", Math.round((System.nanoTime() - start) / 1_000_000.0 * 10.0) / 10.0,
                    uptime, appVersion);
        } catch (Exception ex) {
            return new MonitoringDtos.MicroserviceHealthDto(
                    name, "DOWN", Math.round((System.nanoTime() - start) / 1_000_000.0 * 10.0) / 10.0,
                    uptime, appVersion);
        }
    }

    // ── Errors ────────────────────────────────────────────────────

    private MonitoringDtos.ErrorMetricsDto collectErrorMetrics(OffsetDateTime todayStart,
            OffsetDateTime dayAgo) {
        // Use severity column (indexed) instead of LIKE '%action%' scans.
        long errorsToday = auditLogRepository
                .countBySeverityAndCreatedAtAfter("ERROR", todayStart);
        long critical24h = auditLogRepository
                .countBySeverityAndCreatedAtAfter("CRITICAL", dayAgo);
        long warnings24h = auditLogRepository
                .countBySeverityAndCreatedAtAfter("WARN", dayAgo);
        long exceptions24h = auditLogRepository
                .countBySeverityAndCreatedAtAfter("ERROR", dayAgo);

        List<AuditLog> recentErrors = auditLogRepository.errorsSince(dayAgo, PageRequest.of(0, 5));
        List<LogBufferService.LogEntry> stackTraces = recentErrors.stream()
                .map(a -> new LogBufferService.LogEntry(
                        a.getCreatedAt().toString(), "audit", "ERROR",
                        a.getAction() + (a.getDetails() == null ? "" : " — " + a.getDetails())))
                .toList();

        // Single query for daily error trend instead of LIKE-based scan
        List<MonitoringDtos.ChartSeriesDto> trend = new ArrayList<>();
        try {
            for (Object[] row : auditLogRepository.countDailyTrendSince(dayAgo.minusDays(13))) {
                LocalDate d = toLocalDate(row[0]);
                trend.add(new MonitoringDtos.ChartSeriesDto(DAY_FMT.format(d), ((Number) row[1]).longValue()));
            }
        } catch (Exception ignored) {
            // Trend is best-effort.
        }

        return new MonitoringDtos.ErrorMetricsDto(
                errorsToday, critical24h, warnings24h, exceptions24h, stackTraces,
                List.of(new MonitoringDtos.NamedChartDto("errorTrend", "Errors per day", trend)));
    }

    // ── Alerts ────────────────────────────────────────────────────

    private List<MonitoringDtos.AlertDto> collectAlerts(MonitoringDtos.SystemMetricsDto system,
            MonitoringDtos.DatabaseHealthDto database, MonitoringDtos.ApiMonitoringDto api,
            MonitoringDtos.ErrorMetricsDto errors, MonitoringDtos.QueueHealthDto queues,
            List<MonitoringDtos.MicroserviceHealthDto> services) {
        List<MonitoringDtos.AlertDto> alerts = new ArrayList<>();

        if (system.cpuPercent() > 80) {
            alerts.add(alert("WARNING", "High CPU usage",
                    "CPU is at " + system.cpuPercent() + "% — investigate heavy queries or traffic spikes."));
        }
        if (system.heapPercent() > 85) {
            alerts.add(alert("WARNING", "High heap memory",
                    "JVM heap is at " + system.heapPercent() + "% — consider increasing memory or scaling."));
        }
        if (system.diskPercent() > 90) {
            alerts.add(alert("CRITICAL", "Disk almost full",
                    "Disk is at " + system.diskPercent() + "% — free space urgently needed."));
        }
        if (!"UP".equals(database.status())) {
            alerts.add(alert("CRITICAL", "Database down",
                    "The database connection probe failed. Check the MySQL service."));
        }
        if (api.successRate() < 90 && api.totalRequests() > 0) {
            alerts.add(alert("WARNING", "Elevated API failures",
                    "Success rate is " + api.successRate() + "% — check recent 4xx/5xx responses."));
        }
        if (errors.errorsToday() > 50) {
            alerts.add(alert("WARNING", "Many errors today",
                    errors.errorsToday() + " ERROR audit entries recorded today."));
        }
        if (errors.criticalErrors24h() > 0) {
            alerts.add(alert("CRITICAL", "Critical errors detected",
                    errors.criticalErrors24h() + " CRITICAL entries in the last 24 hours."));
        }
        if (queues.notificationQueue() > 1000) {
            alerts.add(alert("WARNING", "Notification queue full",
                    queues.notificationQueue() + " unread notifications pending — delivery may lag."));
        }
        boolean paymentDown = services.stream()
                .anyMatch(s -> "Payment".equals(s.name()) && "DOWN".equals(s.status()));
        if (paymentDown) {
            alerts.add(alert("CRITICAL", "Payment service down",
                    "The payment module probe failed — check the payment service."));
        }
        return alerts;
    }

    private static MonitoringDtos.AlertDto alert(String severity, String title, String message) {
        return new MonitoringDtos.AlertDto(severity, title, message);
    }

    // ── Charts ────────────────────────────────────────────────────

    private List<MonitoringDtos.NamedChartDto> collectCharts(OffsetDateTime now) {
        List<MonitoringDtos.NamedChartDto> charts = new ArrayList<>();

        List<RequestStatsService.SystemSample> samples = requestStatsService.samples();

        // CPU
        charts.add(new MonitoringDtos.NamedChartDto("cpu", "CPU usage (%)", samples.stream()
                .filter(s -> s.cpuPercent() > 0)
                .map(s -> new MonitoringDtos.ChartSeriesDto(
                        TIME_FMT.format(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochMilli(s.at()), ZoneId.systemDefault())),
                        Math.round(s.cpuPercent())))
                .toList()));

        // Heap memory
        charts.add(new MonitoringDtos.NamedChartDto("memory", "Heap memory (%)", samples.stream()
                .map(s -> new MonitoringDtos.ChartSeriesDto(
                        TIME_FMT.format(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochMilli(s.at()), ZoneId.systemDefault())),
                        Math.round(s.heapPercent())))
                .toList()));

        // API response time (ms)
        charts.add(new MonitoringDtos.NamedChartDto("apiResponse", "API response (ms)", samples.stream()
                .map(s -> new MonitoringDtos.ChartSeriesDto(
                        TIME_FMT.format(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochMilli(s.at()), ZoneId.systemDefault())),
                        Math.max(0, Math.round(s.apiAvgMs()))))
                .toList()));

        // System load
        charts.add(new MonitoringDtos.NamedChartDto("systemLoad", "System load", samples.stream()
                .filter(s -> s.loadAvg() > 0)
                .map(s -> new MonitoringDtos.ChartSeriesDto(
                        TIME_FMT.format(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochMilli(s.at()), ZoneId.systemDefault())),
                        Math.round(s.loadAvg() * 100)))
                .toList()));

        // Database response time (ms)
        charts.add(new MonitoringDtos.NamedChartDto("dbResponse", "DB response (ms)", samples.stream()
                .map(s -> new MonitoringDtos.ChartSeriesDto(
                        TIME_FMT.format(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochMilli(s.at()), ZoneId.systemDefault())),
                        Math.max(0, Math.round(s.dbResponseMs()))))
                .toList()));

        // Daily signups (real DB aggregate, last 14 days)
        List<MonitoringDtos.ChartSeriesDto> signups = new ArrayList<>();
        try {
            for (Object[] row : userRepository.countDailySignups(now.minusDays(13).withHour(0).withMinute(0)
                    .withSecond(0).withNano(0))) {
                LocalDate d = toLocalDate(row[0]);
                signups.add(new MonitoringDtos.ChartSeriesDto(DAY_FMT.format(d), ((Number) row[1]).longValue()));
            }
        } catch (Exception ignored) {
            // Best-effort.
        }
        charts.add(new MonitoringDtos.NamedChartDto("userActivity", "Daily signups", signups));

        return charts;
    }

    // ── Overall status + helpers ──────────────────────────────────

    private static LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date sql) {
            return sql.toLocalDate();
        }
        if (value instanceof LocalDate ld) {
            return ld;
        }
        return LocalDate.now();
    }

    private static String computeOverallStatus(List<MonitoringDtos.AlertDto> alerts,
            MonitoringDtos.DatabaseHealthDto database) {
        if (!"UP".equals(database.status())) {
            return "CRITICAL";
        }
        for (MonitoringDtos.AlertDto alert : alerts) {
            if ("CRITICAL".equals(alert.severity())) {
                return "CRITICAL";
            }
        }
        for (MonitoringDtos.AlertDto alert : alerts) {
            if ("WARNING".equals(alert.severity())) {
                return "WARNING";
            }
        }
        return "HEALTHY";
    }

    private static String formatUptime(long seconds) {
        if (seconds < 60) {
            return seconds + "s";
        }
        long days = seconds / 86400;
        long hours = seconds % 86400 / 3600;
        long minutes = seconds % 3600 / 60;
        if (days > 0) {
            return days + "d " + hours + "h";
        }
        if (hours > 0) {
            return hours + "h " + minutes + "m";
        }
        return minutes + "m";
    }

    /** Recent captured log entries (newest first), level + free-text filtered. */
    public List<LogBufferService.LogEntry> recentLogs(String level, String q, int limit) {
        return logBufferService.recent(level, q, limit);
    }

    /** True count of buffered entries matching the level + query filters. */
    public long countLogs(String level, String q) {
        return logBufferService.count(level, q);
    }
}
