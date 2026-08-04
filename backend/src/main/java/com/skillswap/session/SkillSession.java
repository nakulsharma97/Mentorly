package com.skillswap.session;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Encapsulates skill session.
 */
@Getter
@Setter
@Entity
@Table(name = "sessions")
public class SkillSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "mentor_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User mentor;

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(name = "session_type", nullable = false)
    private String sessionType;

    @Column(name = "start_time", nullable = false)
    private OffsetDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private OffsetDateTime endTime;

    @Column(name = "price_amount", nullable = false)
    private BigDecimal priceAmount;

    @Column(name = "meeting_link")
    private String meetingLink;

    @Column(name = "cancellation_window_hours", nullable = false)
    private Integer cancellationWindowHours = 24;

    @Column(name = "reschedule_window_hours", nullable = false)
    private Integer rescheduleWindowHours = 12;

    @Column(name = "max_participants", nullable = false)
    private Integer maxParticipants = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status = SessionStatus.PENDING;

    // Google Meet Integration Fields
    @Enumerated(EnumType.STRING)
    @Column(name = "meeting_provider")
    private MeetingProvider meetingProvider = MeetingProvider.GOOGLE_CALENDAR;

    @Column(name = "meeting_id")
    private String meetingId;

    @Column(name = "calendar_event_id")
    private String calendarEventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "session_status")
    private LiveSessionStatus liveSessionStatus = LiveSessionStatus.SCHEDULED;

    @ManyToOne
    @JoinColumn(name = "created_by")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "projectsList"})
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    // Helper methods
    public boolean isMeetingGenerated() {
        return meetingLink != null && !meetingLink.isBlank();
    }

    public boolean canJoin() {
        return liveSessionStatus.isActive() && isMeetingGenerated();
    }

    public long getDurationMinutes() {
        if (startTime == null || endTime == null) {
            return 0L;
        }
        return java.time.temporal.ChronoUnit.MINUTES.between(startTime, endTime);
    }

    private static final ObjectMapper SKILLS_MAPPER = new ObjectMapper();

    /**
     * Skills covered by this session, derived from the mentor's skills column.
     *
     * <p>The {@code users.skills} column stores skills as a comma-separated
     * string (e.g. {@code "Java,Spring Boot,React"}) and occasionally as a JSON
     * array. API consumers (e.g. the learner Booked Sessions page) must always
     * receive a JSON <b>array</b> — never a raw string, object, or null — so this
     * computed property is exposed as {@code sessionSkills: List<String>} on the
     * serialized session and is guaranteed to be an empty list rather than null.
     *
     * <p>It is {@code @Transient} so JPA never attempts to persist it.
     *
     * @return a non-null, deduplicated list of trimmed skill names
     */
    @Transient
    public List<String> getSessionSkills() {
        if (mentor == null) {
            return List.of();
        }
        String raw = mentor.getSkills();
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String trimmed = raw.trim();

        // Stored as a JSON array, e.g. ["Java","Spring Boot"] or [{"name":"Java"}]
        if (trimmed.startsWith("[")) {
            try {
                JsonNode node = SKILLS_MAPPER.readTree(trimmed);
                List<String> parsed = new ArrayList<>();
                if (node != null && node.isArray()) {
                    for (JsonNode item : node) {
                        String value = item != null && item.isTextual()
                                ? item.asText()
                                : (item != null && item.has("name") ? item.get("name").asText() : null);
                        if (value != null && !value.isBlank()) {
                            parsed.add(value.trim());
                        }
                    }
                }
                if (!parsed.isEmpty()) {
                    return parsed.stream().distinct().collect(Collectors.toList());
                }
            } catch (Exception ignored) {
                // Not a parseable JSON array — fall back to CSV splitting below.
            }
        }

        // Comma (or ;, |, newline) separated CSV string
        return Arrays.stream(trimmed.split("[,;|\\r\\n]+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }
}
