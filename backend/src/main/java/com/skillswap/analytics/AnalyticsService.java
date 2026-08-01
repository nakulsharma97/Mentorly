package com.skillswap.analytics;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.payment.Payment;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.roadmap.LearningRoadmap;
import com.skillswap.roadmap.LearningRoadmapRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AnalyticsService {

        private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("MMM",
                        Locale.getDefault());
        private static final DateTimeFormatter WEEKDAY_FORMATTER = DateTimeFormatter.ofPattern("EEE",
                        Locale.getDefault());

        private final BookingRepository bookingRepository;
        private final PaymentRepository paymentRepository;
        private final LearningRoadmapRepository learningRoadmapRepository;

        @Value("${app.frontend-base-url:http://localhost:5174}")
        private String frontendBaseUrl;

        public AnalyticsService(
                        BookingRepository bookingRepository,
                        PaymentRepository paymentRepository,
                        LearningRoadmapRepository learningRoadmapRepository) {
                this.bookingRepository = bookingRepository;
                this.paymentRepository = paymentRepository;
                this.learningRoadmapRepository = learningRoadmapRepository;
        }

        public AnalyticsDtos.AnalyticsSummaryDto buildSummary(User currentUser, int rangeDays) {
                AnalyticsDataset dataset = loadDataset(currentUser, rangeDays);
                return buildSummaryFromDataset(dataset);
        }

        public List<AnalyticsDtos.TrendBucketDto> weeklyTrend(User currentUser, int rangeDays) {
                AnalyticsDataset dataset = loadDataset(currentUser, rangeDays);
                return buildWeeklyTrend(dataset.bookings());
        }

        public List<AnalyticsDtos.CancellationReasonDto> cancellationReasons(User currentUser, int rangeDays) {
                AnalyticsDataset dataset = loadDataset(currentUser, rangeDays);
                return buildCancellationReasons(dataset.bookings());
        }

        public AnalyticsDtos.SharePayloadDto sharePayload(User currentUser, int rangeDays) {
                String role = currentUser.getRole() == UserRole.MENTOR ? "MENTOR" : "LEARNER";
                String shareId = UUID.randomUUID().toString();
                String deepLink = String.format(
                                "%s/analytics?rangeDays=%d&role=%s&share=%s",
                                frontendBaseUrl,
                                rangeDays,
                                role.toLowerCase(Locale.ROOT),
                                shareId);

                String title = role.equals("MENTOR") ? "Mentor Performance Snapshot" : "Learner Progress Snapshot";
                String message = role.equals("MENTOR")
                                ? "Sharing my mentor analytics dashboard snapshot from Skill Swapper."
                                : "Sharing my learner analytics dashboard snapshot from Skill Swapper.";

                return new AnalyticsDtos.SharePayloadDto(role, title, message, deepLink);
        }

        private AnalyticsDataset loadDataset(User currentUser, int rangeDays) {
                int normalizedRange = Math.max(7, Math.min(rangeDays, 365));
                OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
                OffsetDateTime cutoff = now.minusDays(normalizedRange);
                boolean mentor = currentUser.getRole() == UserRole.MENTOR;

                List<Booking> bookings = mentor
                                ? bookingRepository.findBySessionMentorId(currentUser.getId())
                                : bookingRepository.findByLearnerIdOrderByCreatedAtDesc(currentUser.getId());

                List<Booking> filteredBookings = bookings.stream()
                                .filter(booking -> eventTime(booking).isAfter(cutoff)
                                                || eventTime(booking).isEqual(cutoff))
                                .toList();

                List<Payment> payments = mentor
                                ? paymentRepository.findByMentorIdAndCreatedAtGreaterThanEqual(
                                                currentUser.getId(),
                                                cutoff)
                                : paymentRepository.findByLearnerIdAndCreatedAtGreaterThanEqual(
                                                currentUser.getId(), cutoff);

                List<LearningRoadmap> roadmaps = mentor
                                ? learningRoadmapRepository.findByBookingSessionMentorId(currentUser.getId())
                                : learningRoadmapRepository.findByBookingLearnerId(currentUser.getId());

                return new AnalyticsDataset(mentor, normalizedRange, now, filteredBookings, payments, roadmaps);
        }

        private AnalyticsDtos.AnalyticsSummaryDto buildSummaryFromDataset(AnalyticsDataset dataset) {
                List<Booking> relevantBookings = dataset.bookings();
                List<Payment> relevantPayments = dataset.payments();

                List<Payment> releasedPayments = relevantPayments.stream()
                                .filter(payment -> "RELEASED".equalsIgnoreCase(String.valueOf(payment.getStatus())))
                                .toList();
                List<Payment> settledPayments = relevantPayments.stream()
                                .filter(payment -> List.of("RELEASED", "COMPLETED", "SUCCEEDED")
                                                .contains(String.valueOf(payment.getStatus()).toUpperCase(Locale.ROOT)))
                                .toList();
                List<Payment> pendingPayments = relevantPayments.stream()
                                .filter(payment -> List.of("HELD", "AUTHORIZED", "PENDING", "ESCROWED", "INITIATED")
                                                .contains(String.valueOf(payment.getStatus()).toUpperCase(Locale.ROOT)))
                                .toList();

                double totalEarnings = releasedPayments.stream().mapToDouble(this::amountOf).sum();
                double totalSpent = settledPayments.stream().mapToDouble(this::amountOf).sum();
                double pendingAmount = pendingPayments.stream().mapToDouble(this::amountOf).sum();

                int studentsCount = (int) relevantBookings.stream()
                                .map(booking -> booking.getLearner() == null ? null : booking.getLearner().getId())
                                .filter(id -> id != null)
                                .distinct()
                                .count();

                int mentorsContacted = (int) relevantBookings.stream()
                                .map(booking -> booking.getSession() == null || booking.getSession().getMentor() == null
                                                ? null
                                                : booking.getSession().getMentor().getId())
                                .filter(id -> id != null)
                                .distinct()
                                .count();

                List<Booking> completedBookings = relevantBookings.stream()
                                .filter(booking -> "COMPLETED"
                                                .equalsIgnoreCase(String.valueOf(booking.getBookingStatus())))
                                .toList();

                double totalHoursLearned = completedBookings.stream().mapToDouble(this::sessionHours).sum();
                int completionRate = relevantBookings.isEmpty()
                                ? 0
                                : (int) Math.round((completedBookings.size() * 100.0) / relevantBookings.size());

                int cancelledCount = (int) relevantBookings.stream()
                                .filter(booking -> "CANCELLED"
                                                .equalsIgnoreCase(String.valueOf(booking.getBookingStatus())))
                                .count();

                int upcomingSessionsCount = (int) relevantBookings.stream()
                                .filter(booking -> eventTime(booking).isAfter(dataset.now()))
                                .filter(booking -> List.of("PENDING", "ACCEPTED", "RESCHEDULE_REQUESTED")
                                                .contains(String.valueOf(booking.getBookingStatus())
                                                                .toUpperCase(Locale.ROOT)))
                                .count();

                List<Integer> progressValues = dataset.roadmaps().stream()
                                .map(roadmap -> roadmap.getProgressPercent() == null ? 0 : roadmap.getProgressPercent())
                                .filter(value -> value > 0)
                                .toList();
                int averageProgress = progressValues.isEmpty()
                                ? 0
                                : (int) Math.round(progressValues.stream().mapToInt(Integer::intValue).average()
                                                .orElse(0));

                int lowProgressRoadmaps = (int) dataset.roadmaps().stream()
                                .map(roadmap -> roadmap.getProgressPercent() == null ? 0 : roadmap.getProgressPercent())
                                .filter(value -> value > 0 && value < 40)
                                .count();

                List<Payment> amountPayments = dataset.mentor() ? releasedPayments : settledPayments;
                double averageSessionValue = amountPayments.isEmpty()
                                ? 0
                                : amountPayments.stream().mapToDouble(this::amountOf).average().orElse(0);

                int goalTarget = dataset.mentor() ? 16 : 12;
                double goalCurrent = dataset.mentor() ? completedBookings.size() : totalHoursLearned;
                String goalUnit = dataset.mentor() ? "sessions" : "hours";
                int goalProgressPercent = (int) Math.min(100,
                                Math.round((goalCurrent / Math.max(1, goalTarget)) * 100));

                Map<Long, Double> paymentBySessionId = new LinkedHashMap<>();
                amountPayments.forEach(payment -> {
                        Long sessionId = payment.getSessionId();
                        if (sessionId != null) {
                                paymentBySessionId.put(sessionId,
                                                paymentBySessionId.getOrDefault(sessionId, 0.0) + amountOf(payment));
                        }
                });

                List<AnalyticsDtos.TopSessionDto> topSessions = relevantBookings.stream()
                                .sorted(Comparator.comparing(this::eventTime).reversed())
                                .limit(6)
                                .map(booking -> new AnalyticsDtos.TopSessionDto(
                                                String.valueOf(booking.getId()),
                                                booking.getSession() == null || booking.getSession().getTitle() == null
                                                                ? "Untitled Session"
                                                                : booking.getSession().getTitle(),
                                                String.valueOf(eventTime(booking)),
                                                String.valueOf(booking.getBookingStatus()),
                                                // Map payment amount by session ID
                                                booking.getSession() != null
                                                                ? paymentBySessionId.getOrDefault(booking.getSession().getId(), 0.0)
                                                                : 0.0,
                                                sessionHours(booking)))
                                .toList();

                AnalyticsDtos.LearnerHistoryDto learnerHistory = buildLearnerHistory(relevantBookings, settledPayments);

                int organic = Math.min(85, 40 + (int) Math.round(averageProgress * 0.35));
                int referral = 25;
                int social = Math.max(8, 100 - organic - referral);
                AnalyticsDtos.AcquisitionDto acquisitions = new AnalyticsDtos.AcquisitionDto(organic, referral, social);

                List<AnalyticsDtos.TrendBucketDto> monthBuckets = buildMonthTrend(
                                dataset.mentor() ? releasedPayments : settledPayments, dataset.now());
                double maxMonthValue = monthBuckets.stream().mapToDouble(AnalyticsDtos.TrendBucketDto::value).max()
                                .orElse(1);

                List<AnalyticsDtos.TrendBucketDto> weeklyBuckets = buildWeeklyTrend(relevantBookings);
                double maxWeeklyValue = weeklyBuckets.stream().mapToDouble(AnalyticsDtos.TrendBucketDto::value).max()
                                .orElse(1);

                return new AnalyticsDtos.AnalyticsSummaryDto(
                                dataset.rangeDays(),
                                dataset.mentor() ? "MENTOR" : "LEARNER",
                                dataset.mentor() ? totalEarnings : totalSpent,
                                pendingAmount,
                                studentsCount,
                                mentorsContacted,
                                relevantBookings.size(),
                                round1(totalHoursLearned),
                                learnerHistory,
                                completionRate,
                                averageProgress,
                                lowProgressRoadmaps,
                                cancelledCount,
                                upcomingSessionsCount,
                                round1(averageSessionValue),
                                goalTarget,
                                round1(goalCurrent),
                                goalUnit,
                                goalProgressPercent,
                                topSessions,
                                acquisitions,
                                monthBuckets,
                                Math.max(1, maxMonthValue),
                                weeklyBuckets,
                                Math.max(1, maxWeeklyValue),
                                4.9);
        }

        private AnalyticsDtos.LearnerHistoryDto buildLearnerHistory(List<Booking> bookings,
                        List<Payment> settledPayments) {
                Map<String, MutableMentorHistory> history = new LinkedHashMap<>();
                Map<Long, String> mentorByBookingId = new LinkedHashMap<>();

                bookings.forEach(booking -> {
                        String mentorName = booking.getSession() != null && booking.getSession().getMentor() != null
                                        && booking.getSession().getMentor().getFullName() != null
                                                        ? booking.getSession().getMentor().getFullName().trim()
                                                        : "Mentor";
                        String mentorUsername = booking.getSession() != null && booking.getSession().getMentor() != null
                                        ? booking.getSession().getMentor().getDisplayUsername()
                                        : "";
                        String mentorKey = booking.getSession() != null && booking.getSession().getMentor() != null
                                        && booking.getSession().getMentor().getId() != null
                                                        ? String.valueOf(booking.getSession().getMentor().getId())
                                                        : mentorName;

                        history.computeIfAbsent(mentorKey, key -> new MutableMentorHistory(mentorKey, mentorName, mentorUsername));
                        mentorByBookingId.put(booking.getId(), mentorKey);

                        if ("COMPLETED".equalsIgnoreCase(String.valueOf(booking.getBookingStatus()))) {
                                MutableMentorHistory current = history.get(mentorKey);
                                current.sessionsAttended += 1;
                                current.totalHours += sessionHours(booking);
                        }
                });

                settledPayments.forEach(payment -> {
                        // Map payment by session ID to find corresponding bookings
                        Long sessionId = payment.getSessionId();
                        if (sessionId == null) {
                                return;
                        }
                        // Find the booking for this session and get its mentor key
                        bookings.stream()
                                .filter(b -> b.getSession() != null && sessionId.equals(b.getSession().getId()))
                                .findFirst()
                                .ifPresent(booking -> {
                                        String mentorKey = mentorByBookingId.get(booking.getId());
                                        if (mentorKey != null && history.containsKey(mentorKey)) {
                                                history.get(mentorKey).totalSpend += amountOf(payment);
                                        }
                                });
                });

                List<AnalyticsDtos.MentorHistoryDto> mentors = history.values().stream()
                                .sorted(Comparator
                                                .comparingDouble((MutableMentorHistory row) -> row.totalSpend)
                                                .reversed()
                                                .thenComparingInt((MutableMentorHistory row) -> row.sessionsAttended)
                                                .reversed()
                                                .thenComparing(row -> row.name))
                                .map(row -> new AnalyticsDtos.MentorHistoryDto(
                                                row.id,
                                                row.name,
                                                row.username,
                                                row.sessionsAttended,
                                                round1(row.totalHours),
                                                round1(row.totalSpend)))
                                .toList();

                int totalSessionsAttended = mentors.stream().mapToInt(AnalyticsDtos.MentorHistoryDto::sessionsAttended)
                                .sum();
                double totalHoursAttended = mentors.stream().mapToDouble(AnalyticsDtos.MentorHistoryDto::totalHours)
                                .sum();
                double averageLength = totalSessionsAttended == 0 ? 0 : totalHoursAttended / totalSessionsAttended;

                return new AnalyticsDtos.LearnerHistoryDto(totalSessionsAttended, round1(averageLength), mentors);
        }

        private List<AnalyticsDtos.TrendBucketDto> buildMonthTrend(List<Payment> payments, OffsetDateTime now) {
                List<OffsetDateTime> months = new ArrayList<>();
                for (int i = 5; i >= 0; i -= 1) {
                        months.add(now.minusMonths(i).withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0)
                                        .withNano(0));
                }

                Map<String, Double> values = new LinkedHashMap<>();
                months.forEach(month -> values.put(month.getYear() + "-" + month.getMonthValue(), 0.0));

                payments.forEach(payment -> {
                        OffsetDateTime createdAt = payment.getCreatedAt();
                        if (createdAt == null) {
                                return;
                        }
                        String key = createdAt.getYear() + "-" + createdAt.getMonthValue();
                        if (values.containsKey(key)) {
                                values.put(key, values.get(key) + amountOf(payment));
                        }
                });

                List<AnalyticsDtos.TrendBucketDto> buckets = new ArrayList<>();
                months.forEach(month -> {
                        String key = month.getYear() + "-" + month.getMonthValue();
                        buckets.add(new AnalyticsDtos.TrendBucketDto(
                                        key,
                                        month.format(MONTH_FORMATTER),
                                        round1(values.getOrDefault(key, 0.0))));
                });

                return buckets;
        }

        private List<AnalyticsDtos.TrendBucketDto> buildWeeklyTrend(List<Booking> bookings) {
                OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
                List<OffsetDateTime> days = new ArrayList<>();
                for (int i = 6; i >= 0; i -= 1) {
                        days.add(now.minusDays(i).withHour(0).withMinute(0).withSecond(0).withNano(0));
                }

                Map<String, Double> counts = new LinkedHashMap<>();
                days.forEach(day -> counts.put(day.getYear() + "-" + day.getMonthValue() + "-" + day.getDayOfMonth(),
                                0.0));

                bookings.stream()
                                .filter(booking -> "COMPLETED"
                                                .equalsIgnoreCase(String.valueOf(booking.getBookingStatus())))
                                .forEach(booking -> {
                                        OffsetDateTime eventTime = eventTime(booking);
                                        String key = eventTime.getYear() + "-" + eventTime.getMonthValue() + "-"
                                                        + eventTime.getDayOfMonth();
                                        if (counts.containsKey(key)) {
                                                counts.put(key, counts.get(key) + 1);
                                        }
                                });

                List<AnalyticsDtos.TrendBucketDto> buckets = new ArrayList<>();
                days.forEach(day -> {
                        String key = day.getYear() + "-" + day.getMonthValue() + "-" + day.getDayOfMonth();
                        buckets.add(new AnalyticsDtos.TrendBucketDto(
                                        key,
                                        day.format(WEEKDAY_FORMATTER),
                                        counts.getOrDefault(key, 0.0)));
                });

                return buckets;
        }

        private List<AnalyticsDtos.CancellationReasonDto> buildCancellationReasons(List<Booking> bookings) {
                Map<String, Long> counts = new LinkedHashMap<>();
                bookings.stream()
                                .filter(booking -> "CANCELLED"
                                                .equalsIgnoreCase(String.valueOf(booking.getBookingStatus())))
                                .forEach(booking -> {
                                        String reason = booking.getCancelReason() == null
                                                        || booking.getCancelReason().isBlank()
                                                                        ? "Unspecified"
                                                                        : booking.getCancelReason().trim();
                                        counts.put(reason, counts.getOrDefault(reason, 0L) + 1);
                                });

                return counts.entrySet().stream()
                                .sorted((left, right) -> Long.compare(right.getValue(), left.getValue()))
                                .map(entry -> new AnalyticsDtos.CancellationReasonDto(entry.getKey(), entry.getValue()))
                                .toList();
        }

        private OffsetDateTime eventTime(Booking booking) {
                if (booking.getSession() != null && booking.getSession().getStartTime() != null) {
                        return booking.getSession().getStartTime();
                }
                return booking.getCreatedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : booking.getCreatedAt();
        }

        private double sessionHours(Booking booking) {
                if (booking.getSession() == null || booking.getSession().getStartTime() == null
                                || booking.getSession().getEndTime() == null) {
                        return 0;
                }
                long seconds = booking.getSession().getEndTime().toEpochSecond()
                                - booking.getSession().getStartTime().toEpochSecond();
                if (seconds <= 0) {
                        return 0;
                }
                return seconds / 3600.0;
        }

        private double amountOf(Payment payment) {
                return payment.getAmount() == null ? 0 : payment.getAmount().doubleValue();
        }

        private double round1(double value) {
                return Math.round(value * 10.0) / 10.0;
        }

        private record AnalyticsDataset(
                        boolean mentor,
                        int rangeDays,
                        OffsetDateTime now,
                        List<Booking> bookings,
                        List<Payment> payments,
                        List<LearningRoadmap> roadmaps) {
        }

        private static final class MutableMentorHistory {
                private final String id;
                private final String name;
                private final String username;
                private int sessionsAttended;
                private double totalHours;
                private double totalSpend;

                private MutableMentorHistory(String id, String name, String username) {
                        this.id = id;
                        this.name = name;
                        this.username = username;
                        this.sessionsAttended = 0;
                        this.totalHours = 0;
                        this.totalSpend = 0;
                }
        }
}
