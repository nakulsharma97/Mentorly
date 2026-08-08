package com.skillswap.availability;

import com.skillswap.booking.BookingRepository;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.session.SessionAutoCreationService;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller exposing availability endpoints.
 */
@RestController
@RequestMapping("/api/v1/availability")
@RequiredArgsConstructor
public class AvailabilityController {

    private static final Logger LOG = LoggerFactory.getLogger(AvailabilityController.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final UserAvailabilitySlotRepository slotRepository;
    private final BookingRepository bookingRepository;
    private final SessionAutoCreationService sessionAutoCreationService;
    private final ProfileCompletionGuard profileCompletionGuard;

    @GetMapping("/my-slots")
    public ApiResponse<List<SlotResponse>> mySlots(@AuthenticationPrincipal User user) {
        List<SlotResponse> slots = slotRepository.findByUserIdAndActiveTrue(user.getId())
                .stream().map(SlotResponse::fromEntity).toList();
        return new ApiResponse<>("Availability slots fetched", slots);
    }

    @PostMapping("/my-slots")
    public ApiResponse<SlotResponse> createSlot(@AuthenticationPrincipal User user,
            @RequestBody SlotRequest req) {
        profileCompletionGuard.requireProfileCompleted(user,
                "Please complete your profile before setting your availability.");
        // Marketplace gate — only admin-APPROVED mentors may publish availability.
        if (!user.isApprovedMentor()) {
            throw new IllegalArgumentException(
                    "Your mentor profile is awaiting verification. You cannot publish availability "
                            + "until an admin approves your profile.");
        }
        LOG.info("createSlot called for userId={}, req={}", user != null ? user.getId() : null, req);
        validateSlotRequest(req);

        UserAvailabilitySlot slot = new UserAvailabilitySlot();
        slot.setUser(user);
        slot.setDayOfWeek(req.dayOfWeek());
        slot.setStartTime(req.startTime());
        slot.setEndTime(req.endTime());
        slot.setTimezone(req.timezone());
        slot.setActive(req.active() == null || req.active());
        UserAvailabilitySlot saved = slotRepository.save(slot);
        LOG.info("Availability slot saved id={} for userId={}", saved.getId(), user.getId());

        // Auto-create sessions from this availability slot
        try {
            List<SkillSession> autoSessions = sessionAutoCreationService.createSessionsFromSlot(saved, user);
            LOG.info("Auto-created {} sessions from availability slot id={}", autoSessions.size(), saved.getId());
        } catch (Exception e) {
            LOG.warn("Failed to auto-create sessions from availability slot id={}: {}", saved.getId(), e.getMessage());
        }

        return new ApiResponse<>("Availability slot created", SlotResponse.fromEntity(saved));
    }

    @PatchMapping("/my-slots/{id}")
    public ApiResponse<SlotResponse> updateSlot(@AuthenticationPrincipal User user,
            @PathVariable Long id, @RequestBody SlotRequest req) {
        profileCompletionGuard.requireProfileCompleted(user,
                "Please complete your profile before setting your availability.");
        // Marketplace gate — only admin-APPROVED mentors may publish availability.
        if (!user.isApprovedMentor()) {
            throw new IllegalArgumentException(
                    "Your mentor profile is awaiting verification. You cannot publish availability "
                            + "until an admin approves your profile.");
        }
        LOG.info("updateSlot called for userId={}, slotId={}", user.getId(), id);
        validateSlotRequest(req);

        UserAvailabilitySlot slot = slotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Availability slot not found"));
        if (!slot.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Cannot update another user's slot");
        }

        slot.setDayOfWeek(req.dayOfWeek());
        slot.setStartTime(req.startTime());
        slot.setEndTime(req.endTime());
        slot.setTimezone(req.timezone());
        slot.setActive(req.active() == null || req.active());
        UserAvailabilitySlot saved = slotRepository.save(slot);
        LOG.info("Availability slot updated id={} for userId={}", saved.getId(), user.getId());

        // Auto-create sessions from this updated availability slot (for future dates)
        try {
            List<SkillSession> autoSessions = sessionAutoCreationService.createSessionsFromSlot(saved, user);
            LOG.info("Auto-created {} sessions from updated availability slot id={}",
                    autoSessions.size(), saved.getId());
        } catch (Exception e) {
            LOG.warn("Failed to auto-create sessions from updated slot id={}: {}", saved.getId(), e.getMessage());
        }

        return new ApiResponse<>("Availability slot updated", SlotResponse.fromEntity(saved));
    }

    @DeleteMapping("/my-slots/{id}")
    public ApiResponse<Boolean> deleteSlot(@AuthenticationPrincipal User user, @PathVariable Long id) {
        UserAvailabilitySlot slot = slotRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Availability slot not found"));
        if (!slot.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Cannot delete another user's slot");
        }
        slotRepository.delete(slot);
        return new ApiResponse<>("Availability slot deleted", true);
    }

    @GetMapping("/mentor/{mentorId}/slots")
    public ApiResponse<List<SlotView>> mentorSlotsInTimezone(
            @PathVariable Long mentorId,
            @RequestParam(required = false) String timezone) {
        String targetTimezone = timezone == null || timezone.isBlank() ? ZoneId.systemDefault().getId() : timezone;
        ZoneId targetZone = ZoneId.of(targetTimezone);

        List<SlotView> slots = slotRepository.findByUserIdAndActiveTrue(mentorId).stream()
                .map(slot -> convertSlotToTargetTimezone(slot, targetZone))
                .sorted(Comparator.comparing(SlotView::dayOfWeek).thenComparing(SlotView::startTime))
                .toList();

        return new ApiResponse<>("Mentor slots fetched", slots);
    }

    @GetMapping("/overlap")
    public ApiResponse<List<SlotView>> overlap(
            @AuthenticationPrincipal User currentUser,
            @RequestParam Long mentorId,
            @RequestParam(required = false) String timezone) {
        String targetTimezone = timezone == null || timezone.isBlank() ? ZoneId.systemDefault().getId() : timezone;
        ZoneId targetZone = ZoneId.of(targetTimezone);

        List<SlotView> mentorSlots = slotRepository.findByUserIdAndActiveTrue(mentorId).stream()
                .map(slot -> convertSlotToTargetTimezone(slot, targetZone))
                .toList();

        List<SlotView> learnerSlots = slotRepository.findByUserIdAndActiveTrue(currentUser.getId()).stream()
                .map(slot -> convertSlotToTargetTimezone(slot, targetZone))
                .toList();

        if (learnerSlots.isEmpty()) {
            return new ApiResponse<>("Overlap slots fetched", mentorSlots);
        }

        List<SlotView> overlapSlots = new ArrayList<>();
        for (SlotView mentor : mentorSlots) {
            for (SlotView learner : learnerSlots) {
                if (!mentor.dayOfWeek().equals(learner.dayOfWeek())) {
                    continue;
                }
                LocalTime start = max(LocalTime.parse(mentor.startTime(), TIME_FMT),
                        LocalTime.parse(learner.startTime(), TIME_FMT));
                LocalTime end = min(LocalTime.parse(mentor.endTime(), TIME_FMT),
                        LocalTime.parse(learner.endTime(), TIME_FMT));
                if (start.isBefore(end)) {
                    overlapSlots.add(new SlotView(
                            mentor.dayOfWeek(),
                            start.format(TIME_FMT),
                            end.format(TIME_FMT),
                            targetTimezone,
                            "Overlap slot"));
                }
            }
        }

        overlapSlots.sort(Comparator.comparing(SlotView::dayOfWeek).thenComparing(SlotView::startTime));
        return new ApiResponse<>("Overlap slots fetched", overlapSlots);
    }

    @GetMapping("/recommendations")
    public ApiResponse<List<RecommendedSlotView>> recommendedSlots(
            @AuthenticationPrincipal User currentUser,
            @RequestParam Long mentorId,
            @RequestParam(required = false) String timezone) {
        String targetTimezone = timezone == null || timezone.isBlank() ? ZoneId.systemDefault().getId() : timezone;
        ZoneId targetZone = ZoneId.of(targetTimezone);

        List<SlotView> overlapSlots = overlap(currentUser, mentorId, targetTimezone).data();
        if (overlapSlots.isEmpty()) {
            return new ApiResponse<>("Recommended slots fetched", List.of());
        }

        Map<Integer, Integer> dayPreference = new HashMap<>();
        Map<Integer, Integer> hourPreference = new HashMap<>();
        bookingRepository.findByLearnerIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .limit(30)
                .forEach(booking -> {
                    if (booking.getSession() == null || booking.getSession().getStartTime() == null) {
                        return;
                    }
                    ZonedDateTime preferred = booking.getSession().getStartTime().atZoneSameInstant(targetZone);
                    int day = preferred.getDayOfWeek().getValue();
                    int hour = preferred.getHour();
                    dayPreference.put(day, dayPreference.getOrDefault(day, 0) + 2);
                    hourPreference.put(hour, hourPreference.getOrDefault(hour, 0) + 1);
                });

        List<RecommendedSlotView> recommended = overlapSlots.stream()
                .map(slot -> {
                    int day = slot.dayOfWeek();
                    int hour = LocalTime.parse(slot.startTime(), TIME_FMT).getHour();
                    int historyScore = dayPreference.getOrDefault(day, 0) + hourPreference.getOrDefault(hour, 0);
                    String reason = historyScore > 0
                            ? "Matches your recent booking time preferences"
                            : "Best timezone overlap with mentor";
                    return new RecommendedSlotView(
                            slot.dayOfWeek(),
                            slot.startTime(),
                            slot.endTime(),
                            slot.timezone(),
                            historyScore,
                            reason);
                })
                .sorted(Comparator.comparingInt(RecommendedSlotView::historyScore).reversed()
                        .thenComparing(RecommendedSlotView::dayOfWeek)
                        .thenComparing(RecommendedSlotView::startTime))
                .limit(10)
                .toList();

        return new ApiResponse<>("Recommended slots fetched", recommended);
    }

    private static SlotView convertSlotToTargetTimezone(UserAvailabilitySlot slot, ZoneId targetZone) {
        ZoneId sourceZone = ZoneId.of(slot.getTimezone());
        DayOfWeek sourceDay = DayOfWeek.of(slot.getDayOfWeek());
        LocalDate sourceDate = LocalDate.now(sourceZone).with(TemporalAdjusters.nextOrSame(sourceDay));

        ZonedDateTime sourceStart = ZonedDateTime.of(sourceDate, LocalTime.parse(slot.getStartTime(), TIME_FMT),
                sourceZone);
        ZonedDateTime sourceEnd = ZonedDateTime.of(sourceDate, LocalTime.parse(slot.getEndTime(), TIME_FMT),
                sourceZone);
        ZonedDateTime targetStart = sourceStart.withZoneSameInstant(targetZone);
        ZonedDateTime targetEnd = sourceEnd.withZoneSameInstant(targetZone);

        return new SlotView(
                targetStart.getDayOfWeek().getValue(),
                targetStart.toLocalTime().format(TIME_FMT),
                targetEnd.toLocalTime().format(TIME_FMT),
                targetZone.getId(),
                "Converted from " + slot.getTimezone());
    }

    private static LocalTime max(LocalTime a, LocalTime b) {
        return a.isAfter(b) ? a : b;
    }

    private static LocalTime min(LocalTime a, LocalTime b) {
        return a.isBefore(b) ? a : b;
    }

    private static void validateSlotRequest(SlotRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Availability request is required");
        }
        if (req.dayOfWeek() == null || req.dayOfWeek() < 1 || req.dayOfWeek() > 7) {
            throw new IllegalArgumentException("dayOfWeek must be between 1 and 7");
        }
        if (req.startTime() == null || req.startTime().isBlank()) {
            throw new IllegalArgumentException("startTime is required");
        }
        if (req.endTime() == null || req.endTime().isBlank()) {
            throw new IllegalArgumentException("endTime is required");
        }
        if (req.timezone() == null || req.timezone().isBlank()) {
            throw new IllegalArgumentException("timezone is required");
        }

        try {
            LocalTime start = LocalTime.parse(req.startTime(), TIME_FMT);
            LocalTime end = LocalTime.parse(req.endTime(), TIME_FMT);
            if (!start.isBefore(end)) {
                throw new IllegalArgumentException("startTime must be before endTime");
            }
            ZoneId.of(req.timezone());
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException(
                    "Invalid availability slot time or timezone. Use HH:mm times and a valid timezone identifier.");
        }
    }

/**
 * Immutable data carrier for slot request.
 */
    public record SlotRequest(Integer dayOfWeek, String startTime, String endTime, String timezone, Boolean active) {
    }

/**
 * Immutable data carrier for slot response.
 */
    public record SlotResponse(Long id, Integer dayOfWeek, String startTime, String endTime,
                               String timezone, boolean active) {
        static SlotResponse fromEntity(UserAvailabilitySlot slot) {
            return new SlotResponse(slot.getId(), slot.getDayOfWeek(), slot.getStartTime(),
                    slot.getEndTime(), slot.getTimezone(), slot.isActive());
        }
    }

/**
 * Immutable data carrier for slot view.
 */
    public record SlotView(Integer dayOfWeek, String startTime, String endTime, String timezone, String note) {
    }

/**
 * Immutable data carrier for recommended slot view.
 */
    public record RecommendedSlotView(
            Integer dayOfWeek,
            String startTime,
            String endTime,
            String timezone,
            Integer historyScore,
            String reason) {
    }
}
