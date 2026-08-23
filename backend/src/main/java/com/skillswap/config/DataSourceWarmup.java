package com.skillswap.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Warms the HikariCP connection pool immediately after the application context
 * is ready. Without this the first real request pays the full cost of opening
 * a MySQL connection (TCP handshake + auth + SSL negotiation), which adds
 * ~200-500ms of latency to the cold-start path.
 *
 * By issuing a trivial query right at startup the pool establishes its
 * minimum connections eagerly, so the first user request gets a warm
 * connection from the pool instead of paying the connection-open penalty.
 */
@Component
@Slf4j
public class DataSourceWarmup {

    private final JdbcTemplate jdbc;

    public DataSourceWarmup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        try {
            long start = System.currentTimeMillis();
            jdbc.queryForObject("SELECT 1", Integer.class);
            long elapsed = System.currentTimeMillis() - start;
            log.info("DataSource warmed up in {}ms", elapsed);
        } catch (Exception e) {
            log.warn("DataSource warmup failed — first request may be slower", e);
        }
    }
}
