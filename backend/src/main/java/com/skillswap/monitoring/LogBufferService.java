package com.skillswap.monitoring;

import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import jakarta.annotation.PostConstruct;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Captures real application log events (INFO / WARN / ERROR / DEBUG) into an
 * in-memory ring buffer via a Logback appender, so the admin monitoring page
 * can display genuine logs with level, service, timestamp, and message —
 * searchable and paginated. Nothing is faked: every entry is a real log line
 * produced by the running application.
 */
@Component
public class LogBufferService {

    private static final int MAX_BUFFERED = 2000;

    /** A captured log entry. */
    public record LogEntry(String timestamp, String service, String level, String message) {}

    private final ConcurrentLinkedDeque<LogEntry> buffer = new ConcurrentLinkedDeque<>();

    @PostConstruct
    void attachAppender() {
        try {
            LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
            MonitoringLogAppender appender = new MonitoringLogAppender(this);
            appender.setContext(context);
            appender.start();
            ch.qos.logback.classic.Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
            root.addAppender(appender);
        } catch (Exception ignored) {
            // The log buffer must never break application startup.
        }
    }

    /**
     * Called by the Logback appender on every log event. Only app-level logs
     * (com.skillswap) and WARN/ERROR events from other loggers are captured so
     * Spring Security's DEBUG noise cannot flood the ring buffer.
     */
    public void append(String level, String loggerName, String message) {
        if (loggerName != null && !loggerName.startsWith("com.skillswap")
                && !"WARN".equals(level) && !"ERROR".equals(level)) {
            return;
        }
        buffer.addLast(new LogEntry(
                Instant.now().toString(),
                shortName(loggerName),
                level,
                message == null ? "" : message));
        while (buffer.size() > MAX_BUFFERED) {
            buffer.pollFirst();
        }
    }

    /**
     * Returns buffered entries filtered by optional level and free-text query
     * (matched against message and service), newest first.
     */
    public List<LogEntry> recent(String level, String q, int limit) {
        List<LogEntry> result = new ArrayList<>();
        var it = buffer.descendingIterator();
        while (it.hasNext()) {
            LogEntry entry = it.next();
            if (!matches(entry, level, q)) {
                continue;
            }
            result.add(entry);
            if (result.size() >= limit) {
                break;
            }
        }
        return result;
    }

    /** Counts buffered entries matching the level + query filters (no limit). */
    public long count(String level, String q) {
        long total = 0;
        var it = buffer.descendingIterator();
        while (it.hasNext()) {
            if (matches(it.next(), level, q)) {
                total++;
            }
        }
        return total;
    }

    /** Shared filter predicate used by {@link #recent} and {@link #count}. */
    private static boolean matches(LogEntry entry, String level, String q) {
        if (level != null && !level.isBlank() && !entry.level().equalsIgnoreCase(level)) {
            return false;
        }
        if (q != null && !q.isBlank()) {
            String lower = q.toLowerCase();
            if (!entry.message().toLowerCase().contains(lower)
                    && !entry.service().toLowerCase().contains(lower)) {
                return false;
            }
        }
        return true;
    }

    public long size() {
        return buffer.size();
    }

    private static String shortName(String name) {
        if (name == null || name.isBlank()) {
            return "app";
        }
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot + 1) : name;
    }

    /** Logback appender that forwards every log event into the ring buffer. */
    private static final class MonitoringLogAppender extends AppenderBase<ILoggingEvent> {

        private final LogBufferService service;

        MonitoringLogAppender(LogBufferService service) {
            this.service = service;
        }

        @Override
        protected void append(ILoggingEvent event) {
            try {
                service.append(event.getLevel().toString(), event.getLoggerName(), event.getFormattedMessage());
            } catch (Exception ignored) {
                // Never propagate log capture failures into the request path.
            }
        }
    }
}
