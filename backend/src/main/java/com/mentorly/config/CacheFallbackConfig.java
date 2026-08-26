package com.mentorly.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fallback cache manager when Redis is not enabled.
 *
 * <p>When {@code app.redis.enabled=false} (tests, local dev without Redis),
 * this provides an in-memory ConcurrentMapCacheManager so that
 * {@code @Cacheable}/{@code @CacheEvict} annotations still work correctly
 * without requiring a running Redis instance.
 *
 * <p>In production, set {@code APP_REDIS_ENABLED=true} to activate the
 * real {@link RedisConfig} instead.
 */
@Configuration
@EnableCaching
@ConditionalOnProperty(name = "app.redis.enabled", havingValue = "false", matchIfMissing = true)
public class CacheFallbackConfig {

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager(
                "communityStats",
                "skills",
                "mentorProfile",
                "mentorList",
                "mentorSkills",
                "mentorReviews",
                "mentorRating"
        );
    }
}
