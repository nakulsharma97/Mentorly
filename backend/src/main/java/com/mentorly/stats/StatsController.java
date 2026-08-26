package com.mentorly.stats;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * REST controller exposing stats endpoints.
 */
@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class StatsController {
    private final StatsService statsService;

    @GetMapping("/community-stats")
    public ResponseEntity<CommunityStatsDto> communityStats() {
        // Cache for 25s at HTTP level — the service caches for 30s internally.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(25)))
                .body(statsService.getCommunityStats());
    }
}
