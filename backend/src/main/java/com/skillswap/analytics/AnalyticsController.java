package com.skillswap.analytics;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    public ApiResponse<AnalyticsDtos.AnalyticsSummaryDto> summary(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "30") int rangeDays) {
        int normalized = normalizeRange(rangeDays);
        return new ApiResponse<>("Analytics summary fetched", analyticsService.buildSummary(currentUser, normalized));
    }

    @GetMapping("/weekly-trend")
    public ApiResponse<List<AnalyticsDtos.TrendBucketDto>> weeklyTrend(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "30") int rangeDays) {
        int normalized = normalizeRange(rangeDays);
        return new ApiResponse<>("Weekly trend fetched", analyticsService.weeklyTrend(currentUser, normalized));
    }

    @GetMapping("/cancellation-reasons")
    public ApiResponse<List<AnalyticsDtos.CancellationReasonDto>> cancellationReasons(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "30") int rangeDays) {
        int normalized = normalizeRange(rangeDays);
        return new ApiResponse<>("Cancellation reasons fetched",
                analyticsService.cancellationReasons(currentUser, normalized));
    }

    @PostMapping("/share")
    public ApiResponse<AnalyticsDtos.SharePayloadDto> share(
            @AuthenticationPrincipal User currentUser,
            @RequestBody(required = false) ShareRequest request) {
        int rangeDays = normalizeRange(request == null || request.rangeDays() == null ? 30 : request.rangeDays());
        return new ApiResponse<>("Share payload generated", analyticsService.sharePayload(currentUser, rangeDays));
    }

    @PostMapping("/events")
    public ApiResponse<Map<String, Object>> ingestEvent(
            @AuthenticationPrincipal User currentUser,
            @RequestBody EventRequest request) {
        String name = request == null || request.name() == null || request.name().isBlank()
                ? "unknown_event"
                : request.name().trim();
        Map<String, Object> payload = request == null || request.payload() == null ? Map.of() : request.payload();
        log.info("analytics_event_ingested userId={} role={} event={} payloadKeys={}",
                currentUser.getId(),
                currentUser.getRole(),
                name,
                payload.keySet());
        return new ApiResponse<>("Event ingested", Map.of("accepted", true, "event", name));
    }

    private int normalizeRange(int rangeDays) {
        return Math.max(7, Math.min(365, rangeDays));
    }

    public record ShareRequest(Integer rangeDays) {
    }

    public record EventRequest(String name, Map<String, Object> payload) {
    }
}
