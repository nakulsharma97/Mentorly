package com.mentorly;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Encapsulates Mentorly application.
 */
@SpringBootApplication
@EnableScheduling
public class MentorlyApplication {

    public static void main(String[] args) {
        SpringApplication.run(MentorlyApplication.class, args);
    }
}
