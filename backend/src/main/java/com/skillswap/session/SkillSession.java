package com.skillswap.session;

import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

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
        return java.time.temporal.ChronoUnit.MINUTES.between(startTime, endTime);
    }
}
