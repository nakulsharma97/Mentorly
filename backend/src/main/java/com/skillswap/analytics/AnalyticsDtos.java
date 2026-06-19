package com.skillswap.analytics;

import java.util.List;

public final class AnalyticsDtos {
    private AnalyticsDtos() {
    }

    public record AnalyticsSummaryDto(
            int rangeDays,
            String role,
            double totalAmount,
            double pendingAmount,
            int studentsCount,
            int mentorsContacted,
            int sessionsCount,
            double hoursLearned,
            LearnerHistoryDto learnerHistory,
            int completionRate,
            int averageProgress,
            int lowProgressRoadmaps,
            int cancelledCount,
            int upcomingSessionsCount,
            double averageSessionValue,
            int goalTarget,
            double goalCurrent,
            String goalUnit,
            int goalProgressPercent,
            List<TopSessionDto> topSessions,
            AcquisitionDto acquisitions,
            List<TrendBucketDto> monthBuckets,
            double maxMonthValue,
            List<TrendBucketDto> weeklyBuckets,
            double maxWeeklyValue,
            double avgRating) {
    }

    public record LearnerHistoryDto(
            int totalSessionsAttended,
            double averageSessionLengthHours,
            List<MentorHistoryDto> mentors) {
    }

    public record MentorHistoryDto(
            String id,
            String name,
            int sessionsAttended,
            double totalHours,
            double totalSpend) {
    }

    public record TopSessionDto(
            String id,
            String title,
            String date,
            String status,
            double amount,
            double hours) {
    }

    public record AcquisitionDto(
            int organic,
            int referral,
            int social) {
    }

    public record TrendBucketDto(
            String key,
            String label,
            double value) {
    }

    public record CancellationReasonDto(
            String reason,
            long count) {
    }

    public record SharePayloadDto(
            String role,
            String title,
            String message,
            String url) {
    }
}
