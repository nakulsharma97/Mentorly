package com.skillswap.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.concurrent.Executor;

/**
 * Encapsulates web.
 */
@Configuration
@EnableRetry
@EnableAsync
public class WebConfig implements AsyncConfigurer, WebMvcConfigurer {

    private static final Logger LOG = LoggerFactory.getLogger(WebConfig.class);

    @Bean(name = "emailTaskExecutor")
    public Executor emailTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("email-async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (Throwable ex, Method method, Object... params) -> {
            LOG.error(
                "Uncaught async exception in method '{}' of class {} with params: {}",
                method.getName(),
                method.getDeclaringClass().getSimpleName(),
                Arrays.toString(params),
                ex
            );
        };
    }

    // NOTE: /uploads/** is deliberately NOT registered as a public static
    // resource handler. Uploaded files are served exclusively through
    // GET /api/v1/files/{id}/content, which enforces ownership, chat
    // participant, admin, and expiry checks (see StoredFileService).
}
