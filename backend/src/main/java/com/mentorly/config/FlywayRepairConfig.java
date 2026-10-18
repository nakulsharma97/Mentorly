package com.mentorly.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayRepairConfig {

    @Bean
    public FlywayMigrationStrategy flywayStrategy(
            @Value("${FLYWAY_REPAIR_ON_START:false}") boolean repair) {
        return flyway -> {
            if (repair) {
                flyway.repair();
            }
            flyway.migrate();
        };
    }
}