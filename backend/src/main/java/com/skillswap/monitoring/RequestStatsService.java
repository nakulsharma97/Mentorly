package com.skillswap.monitoring;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory request statistics recorded by {@code RequestTraceFilter} for every
 * HTTP request that reaches the backend. Tracks per-endpoint counts, failures
 * (status >= 400), total latency, and a rolling {@link SystemSample} history so
 * the monitoring dashboard can render real CPU / memory / API-latency charts
 * that accumulate over time. All values are measured live — nothing is seeded.
 */
/**
 * Service implementing request stats business logic.
 */
@Component
public class RequestStatsService {

/**
 * Immutable data carrier for endpoint stat.
 */
    public record EndpointStat(String path, long count, long failures, long totalDurationMs) {
        public double avgResponseTimeMs() {
            return count == 0 ? 0 : totalDurationMs / (double) count;
        }
    }

/**
 * Immutable data carrier for system sample.
 */
    public record SystemSample(long at, double cpuPercent, double heapPercent,
            double dbResponseMs, double apiAvgMs, double loadAvg) { }

    private static final int MAX_HISTORY = 120;

    private final ConcurrentHashMap<String, Stat> byPath = new ConcurrentHashMap<>();
    private final ConcurrentLinkedDeque<SystemSample> history = new ConcurrentLinkedDeque<>();
    private final AtomicLong totalRequests = new AtomicLong();
    private final AtomicLong failedRequests = new AtomicLong();
    private final AtomicLong failedToday = new AtomicLong();
    private final AtomicLong totalDurationMs = new AtomicLong();
    private final ConcurrentHashMap<Integer, AtomicLong> failuresByStatus = new ConcurrentHashMap<>();

    private static final class Stat {
        long count;
        long failures;
        long totalDurationMs;
    }

    /**
     * Records one completed request. Called from {@code RequestTraceFilter}
     * with the resolved URI, measured duration and final HTTP status.
     */
    public void record(String path, long durationMs, int status) {
        if (path == null || path.isBlank()) {
            return;
        }
        String key = normalize(path);
        Stat stat = byPath.computeIfAbsent(key, k -> new Stat());
        synchronized (stat) {
            stat.count++;
            stat.totalDurationMs += durationMs;
            if (status >= 400) {
                stat.failures++;
            }
        }
        totalRequests.incrementAndGet();
        totalDurationMs.addAndGet(durationMs);
        if (status >= 400) {
            failedRequests.incrementAndGet();
            failedToday.incrementAndGet();
            failuresByStatus.computeIfAbsent(status, k -> new AtomicLong()).incrementAndGet();
        }
    }

    /** Appends a sampled snapshot for the live charts (bounded ring buffer). */
    public void recordSample(SystemSample sample) {
        history.addLast(sample);
        while (history.size() > MAX_HISTORY) {
            history.pollFirst();
        }
    }

    /** Collapses numeric path segments so /users/12 and /users/99 share one bucket. */
    private static String normalize(String path) {
        return path.replaceAll("/\\d+", "/:id");
    }

    public List<EndpointStat> endpoints() {
        return byPath.entrySet().stream()
                .map(e -> new EndpointStat(e.getKey(), e.getValue().count,
                        e.getValue().failures, e.getValue().totalDurationMs))
                .sorted(Comparator.comparingLong(EndpointStat::count).reversed())
                .toList();
    }

    public long totalRequests() {
        return totalRequests.get();
    }

    public long failedRequests() {
        return failedRequests.get();
    }

    public long failedToday() {
        return failedToday.get();
    }

    public long totalDurationMs() {
        return totalDurationMs.get();
    }

    public double avgResponseTimeMs() {
        long total = totalRequests.get();
        return total == 0 ? 0 : totalDurationMs.get() / (double) total;
    }

    public Map<Integer, Long> failuresByStatus() {
        Map<Integer, Long> out = new TreeMap<>();
        failuresByStatus.forEach((code, count) -> out.put(code, count.get()));
        return out;
    }

    public List<SystemSample> samples() {
        return new ArrayList<>(history);
    }
}
