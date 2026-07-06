package com.skillswap.stats;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class StatsController {
    private final StatsService statsService;

    @GetMapping("/community-stats")
    public ResponseEntity<CommunityStatsDto> communityStats() {
        return ResponseEntity.ok(statsService.getCommunityStats());
    }
}
