package com.skillswap.analytics;

import java.util.List;

/**
 * Encapsulates analytics dtos.
 */
public final class AnalyticsDtos {
    private AnalyticsDtos() {
    }

/**
 * Immutable data carrier for analytics summary.
 */
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

/**
 * Immutable data carrier for learner history.
 */
    public record LearnerHistoryDto(
            int totalSessionsAttended,
            double averageSessionLengthHours,
            List<MentorHistoryDto> mentors) {
    }

/**
 * Immutable data carrier for mentor history.
 */
    public record MentorHistoryDto(
            String id,
            String name,
            String username,
            int sessionsAttended,
            double totalHours,
            double totalSpend) {
    }

/**
 * Immutable data carrier for top session.
 */
    public record TopSessionDto(
            String id,
            String title,
            String date,
            String status,
            double amount,
            double hours) {
    }

/**
 * Immutable data carrier for acquisition.
 */
    public record AcquisitionDto(
            int organic,
            int referral,
            int social) {
    }

/**
 * Immutable data carrier for trend bucket.
 */
    public record TrendBucketDto(
            String key,
            String label,
            double value) {
    }

/**
 * Immutable data carrier for cancellation reason.
 */
    public record CancellationReasonDto(
            String reason,
            long count) {
    }

/**
 * Immutable data carrier for share payload.
 */
    public record SharePayloadDto(
            String role,
            String title,
            String message,
            String url) {
    }
}
