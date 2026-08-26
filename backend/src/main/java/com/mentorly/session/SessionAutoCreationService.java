package com.mentorly.session;

import com.mentorly.availability.UserAvailabilitySlot;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * Automatically creates SkillSession entities from mentor availability slots.
 * When a mentor creates or updates an availability slot (e.g. "Monday 9-5 UTC"),
 * this service generates dated SkillSession instances for the upcoming 2 weeks.
 */
/**
 * Service implementing session auto creation business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionAutoCreationService {

    private static final Logger LOG = LoggerFactory.getLogger(SessionAutoCreationService.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int WEEKS_AHEAD = 2;

    private final SessionRepository sessionRepository;

    /**
     * Auto-create sessions from a single availability slot for the upcoming weeks.
     * Skips dates where a session already exists for this mentor + start time.
     *
     * @param slot      the availability slot (dayOfWeek, startTime, endTime, timezone)
     * @param mentor    the mentor who owns the slot
     * @return list of newly created SkillSession records
     */
    @Transactional
    public List<SkillSession> createSessionsFromSlot(UserAvailabilitySlot slot, User mentor) {
        List<SkillSession> created = new ArrayList<>();

        ZoneId slotZone = ZoneId.of(slot.getTimezone());
        LocalTime startLocal = LocalTime.parse(slot.getStartTime(), TIME_FMT);
        LocalTime endLocal = LocalTime.parse(slot.getEndTime(), TIME_FMT);
        DayOfWeek dayOfWeek = DayOfWeek.of(slot.getDayOfWeek());

        LocalDate today = LocalDate.now(slotZone);

        // Create sessions for the next N weeks starting from next week
        for (int week = 1; week <= WEEKS_AHEAD; week++) {
            // Find the next occurrence of this day-of-week from today + week offset
            LocalDate targetDate = today.with(TemporalAdjusters.next(dayOfWeek))
                    .plusWeeks(week - 1);

            // If the target date is already in the past (or today), skip
            if (!targetDate.isAfter(today)) {
                continue;
            }

            ZonedDateTime slotStartZoned = ZonedDateTime.of(targetDate, startLocal, slotZone);
            ZonedDateTime slotEndZoned = ZonedDateTime.of(targetDate, endLocal, slotZone);

            OffsetDateTime startTime = slotStartZoned.toOffsetDateTime();
            OffsetDateTime endTime = slotEndZoned.toOffsetDateTime();

            // Check for duplicate: session already exists for this mentor at this time
            if (sessionRepository.existsByMentorIdAndStartTime(mentor.getId(), startTime)) {
                LOG.debug("Skipping duplicate session for mentor={} at time={}", mentor.getId(), startTime);
                continue;
            }

            // Build session with simple defaults
            SkillSession session = new SkillSession();
            session.setMentor(mentor);
            session.setTitle(buildDefaultTitle(mentor));
            session.setDescription("");
            // Availability slots publish discoverable 1:1 sessions → PUBLIC.
            session.setSessionType(SessionType.PUBLIC);
            session.setStartTime(startTime);
            session.setEndTime(endTime);
            session.setPriceAmount(buildDefaultPrice(mentor));
            session.setMeetingLink(null);
            session.setCancellationWindowHours(24);
            session.setRescheduleWindowHours(12);
            session.setMaxParticipants(1);
            session.setStatus(SessionStatus.PENDING);
            session.setMeetingProvider(MeetingProvider.GOOGLE_CALENDAR);
            session.setLiveSessionStatus(LiveSessionStatus.SCHEDULED);
            session.setCreatedBy(mentor);
            session.setCreatedAt(OffsetDateTime.now());
            session.setUpdatedAt(OffsetDateTime.now());

            SkillSession saved = sessionRepository.save(session);
            created.add(saved);
            LOG.info("Auto-created session id={} title='{}' for mentor={} at {}",
                    saved.getId(), saved.getTitle(), mentor.getId(), startTime);
        }

        if (created.isEmpty()) {
            LOG.debug("No new sessions created from availability slot id={} for mentor={}",
                    slot.getId(), mentor.getId());
        }

        return created;
    }

    /**
     * Build a default title from the mentor's profile.
     * Uses headline if available, otherwise skills, otherwise a generic title.
     */
    private String buildDefaultTitle(User mentor) {
        if (mentor.getHeadline() != null && !mentor.getHeadline().isBlank()) {
            return mentor.getHeadline();
        }
        if (mentor.getSkills() != null && !mentor.getSkills().isBlank()) {
            // Take the first skill as the title
            String firstSkill = mentor.getSkills().split(",")[0].trim();
            return firstSkill + " Mentoring";
        }
        if (mentor.getFullName() != null) {
            return "Session with " + mentor.getFullName();
        }
        return "Mentoring Session";
    }

    /**
     * Build a default price from the mentor's hourly rate, defaulting to 0.
     */
    private BigDecimal buildDefaultPrice(User mentor) {
        if (mentor.getHourlyRate() != null && mentor.getHourlyRate().compareTo(BigDecimal.ZERO) > 0) {
            return mentor.getHourlyRate();
        }
        return BigDecimal.ZERO;
    }
}
