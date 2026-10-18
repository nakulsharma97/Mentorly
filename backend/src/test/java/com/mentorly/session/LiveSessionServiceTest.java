package com.mentorly.session;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.meeting.google.GoogleCalendarMeetingProvider;
import com.mentorly.meeting.provider.MeetingProviderException;
import com.mentorly.session.dto.CreateLiveSessionRequest;
import com.mentorly.session.dto.LiveSessionResponse;
import com.mentorly.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies that the Google Meet integration is best-effort: sessions are still
 * scheduled (with a pending link) when Google Calendar is not connected, and a
 * calendar failure cannot block an update or a cancellation.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LiveSessionServiceTest {

    @Mock
    private SessionRepository sessionRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private GoogleCalendarMeetingProvider meetingProvider;

    @InjectMocks
    private LiveSessionService service;

    private User mentor;

    @BeforeEach
    void setUp() {
        mentor = new User();
        mentor.setId(5L);
        mentor.setFullName("Rahul Sharma");

        when(sessionRepository.save(any(SkillSession.class))).thenAnswer(invocation -> {
            SkillSession session = invocation.getArgument(0);
            if (session.getId() == null) {
                session.setId(42L);
            }
            return session;
        });
        when(bookingRepository.countBySessionIdAndApprovedByAdminTrue(anyLong())).thenReturn(0L);
        when(bookingRepository.countBySessionIdAndBookingStatus(anyLong(), eq(BookingStatus.REJECTED)))
                .thenReturn(0L);
        when(bookingRepository.countPendingNotApprovedBySessionId(anyLong(), eq(BookingStatus.PENDING)))
                .thenReturn(0L);
    }

    @Test
    void keepsScheduledSessionWithPendingLinkWhenCalendarIsNotConnected() throws Exception {
        when(meetingProvider.createMeeting(any(SkillSession.class))).thenThrow(
                new MeetingProviderException("GOOGLE_CALENDAR", "NOT_CONFIGURED",
                        "Google Calendar is not properly configured"));

        LiveSessionResponse response = service.createLiveSession(request(), mentor);

        assertThat(response.getId()).isEqualTo(42L);
        assertThat(response.getStatus()).isEqualTo(LiveSessionStatus.SCHEDULED);
        assertThat(response.isMeetingGenerated()).isFalse();
        assertThat(response.isMeetingLinkPending()).isTrue();
        // The previous behaviour deleted the session and rethrew — never again.
        verify(sessionRepository, never()).delete(any(SkillSession.class));
    }

    @Test
    void keepsScheduledSessionWithPendingLinkWhenMeetCreationFails() throws Exception {
        when(meetingProvider.createMeeting(any(SkillSession.class))).thenThrow(
                new MeetingProviderException("GOOGLE_CALENDAR", "API_ERROR", "boom"));

        LiveSessionResponse response = service.createLiveSession(request(), mentor);

        assertThat(response.getStatus()).isEqualTo(LiveSessionStatus.SCHEDULED);
        assertThat(response.isMeetingLinkPending()).isTrue();
        verify(sessionRepository, never()).delete(any(SkillSession.class));
    }

    @Test
    void setsMeetingLinkWhenProviderSucceeds() throws Exception {
        when(meetingProvider.createMeeting(any(SkillSession.class)))
                .thenReturn("https://meet.google.com/abc-defg-hij");

        LiveSessionResponse response = service.createLiveSession(request(), mentor);

        assertThat(response.isMeetingGenerated()).isTrue();
        assertThat(response.isMeetingLinkPending()).isFalse();
    }

    @Test
    void updateSucceedsEvenWhenTheCalendarEventCannotBeUpdated() throws Exception {
        SkillSession existing = session();
        existing.setCalendarEventId("event-1");
        when(sessionRepository.findById(42L)).thenReturn(java.util.Optional.of(existing));
        doThrow(new MeetingProviderException("GOOGLE_CALENDAR", "API_ERROR", "boom"))
                .when(meetingProvider).updateMeeting(any(SkillSession.class), any());

        CreateLiveSessionRequest update = request();
        update.setTitle("Updated title");

        LiveSessionResponse response = service.updateLiveSession(42L, update, mentor);

        assertThat(response.getTitle()).isEqualTo("Updated title");
        verify(sessionRepository).save(existing);
    }

    @Test
    void cancellationSucceedsEvenWhenTheCalendarEventCannotBeDeleted() throws Exception {
        SkillSession existing = session();
        existing.setCalendarEventId("event-1");
        when(sessionRepository.findById(42L)).thenReturn(java.util.Optional.of(existing));
        doThrow(new MeetingProviderException("GOOGLE_CALENDAR", "API_ERROR", "boom"))
                .when(meetingProvider).deleteMeeting("event-1");

        service.cancelLiveSession(42L, mentor);

        assertThat(existing.getLiveSessionStatus()).isEqualTo(LiveSessionStatus.CANCELLED);
    }

    /* ── Fixtures ────────────────────────────────────────────────────── */

    private CreateLiveSessionRequest request() {
        OffsetDateTime start = OffsetDateTime.now(ZoneOffset.UTC).plusDays(2);
        return CreateLiveSessionRequest.builder()
                .title("Spring Boot deep dive")
                .description("Hands-on session")
                .startTime(start)
                .endTime(start.plusHours(1))
                .priceAmount(new BigDecimal("499.00"))
                .maxParticipants(1)
                .build();
    }

    private SkillSession session() {
        SkillSession session = new SkillSession();
        session.setId(42L);
        session.setMentor(mentor);
        session.setTitle("Spring Boot deep dive");
        session.setStartTime(OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));
        session.setEndTime(OffsetDateTime.now(ZoneOffset.UTC).plusDays(2).plusHours(1));
        session.setPriceAmount(new BigDecimal("499.00"));
        session.setMaxParticipants(1);
        session.setLiveSessionStatus(LiveSessionStatus.SCHEDULED);
        return session;
    }
}
