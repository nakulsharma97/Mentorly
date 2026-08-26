package com.mentorly.meeting.google;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.ConferenceSolutionKey;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.EntryPoint;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.mentorly.meeting.provider.MeetingDetails;
import com.mentorly.meeting.provider.MeetingProviderException;
import com.mentorly.meeting.provider.MeetingProviderService;
import com.mentorly.session.SkillSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * Implementation of MeetingProviderService for Google Calendar.
 * Handles automatic Google Meet link generation using Google Calendar API.
 */
/**
 * Encapsulates google calendar meeting provider.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoogleCalendarMeetingProvider implements MeetingProviderService {

    private final GoogleCalendarProperties googleCalendarProperties;
    private final GoogleOAuthTokenManager oauthTokenManager;

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    @Override
    public String createMeeting(SkillSession session) throws MeetingProviderException {
        if (!isConfigured()) {
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "NOT_CONFIGURED",
                    "Google Calendar is not properly configured. Missing required credentials.");
        }

        try {
            Calendar calendar = buildCalendarService();

            // Create event with Google Meet conference
            Event event = new Event()
                    .setSummary(session.getTitle())
                    .setDescription(buildEventDescription(session))
                    .setStart(convertToDateTime(session.getStartTime()))
                    .setEnd(convertToDateTime(session.getEndTime()))
                    .setConferenceData(buildConferenceData());

            // Create the event with conference data
            Event createdEvent = calendar.events()
                    .insert("primary", event)
                    .setConferenceDataVersion(1)
                    .execute();

            log.info("Google Meet event created successfully. Event ID: {}", createdEvent.getId());

            // Extract and return the meeting link
            if (createdEvent.getConferenceData() != null
                    && createdEvent.getConferenceData().getEntryPoints() != null) {
                for (EntryPoint entryPoint : createdEvent.getConferenceData().getEntryPoints()) {
                    if ("video".equalsIgnoreCase(entryPoint.getEntryPointType())) {
                        log.info("Google Meet link generated: {}", entryPoint.getUri());
                        // Store the event ID for future updates/deletions
                        session.setCalendarEventId(createdEvent.getId());
                        return entryPoint.getUri();
                    }
                }
            }

            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "NO_MEET_LINK",
                    "Google Meet link was not generated in the conference data");

        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to create Google Meet event", e);
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "API_ERROR",
                    "Failed to create Google Meet event: " + e.getMessage(),
                    e);
        }
    }

    @Override
    public void updateMeeting(SkillSession session, String meetingId) throws MeetingProviderException {
        if (!isConfigured()) {
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "NOT_CONFIGURED",
                    "Google Calendar is not properly configured");
        }

        try {
            Calendar calendar = buildCalendarService();

            // Get the existing event
            Event event = calendar.events()
                    .get("primary", session.getCalendarEventId())
                    .execute();

            // Update the event details
            event.setSummary(session.getTitle());
            event.setDescription(buildEventDescription(session));
            event.setStart(convertToDateTime(session.getStartTime()));
            event.setEnd(convertToDateTime(session.getEndTime()));

            // Update the event
            calendar.events()
                    .update("primary", session.getCalendarEventId(), event)
                    .setConferenceDataVersion(1)
                    .execute();

            log.info("Google Meet event updated successfully. Event ID: {}", session.getCalendarEventId());

        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to update Google Meet event", e);
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "API_ERROR",
                    "Failed to update Google Meet event: " + e.getMessage(),
                    e);
        }
    }

    @Override
    public void deleteMeeting(String meetingId) throws MeetingProviderException {
        if (!isConfigured()) {
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "NOT_CONFIGURED",
                    "Google Calendar is not properly configured");
        }

        try {
            Calendar calendar = buildCalendarService();

            // Delete the event
            calendar.events()
                    .delete("primary", meetingId)
                    .execute();

            log.info("Google Meet event deleted successfully. Event ID: {}", meetingId);

        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to delete Google Meet event", e);
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "API_ERROR",
                    "Failed to delete Google Meet event: " + e.getMessage(),
                    e);
        }
    }

    @Override
    public MeetingDetails getMeeting(String meetingId) throws MeetingProviderException {
        if (!isConfigured()) {
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "NOT_CONFIGURED",
                    "Google Calendar is not properly configured");
        }

        try {
            Calendar calendar = buildCalendarService();

            Event event = calendar.events()
                    .get("primary", meetingId)
                    .execute();

            String meetingLink = null;
            if (event.getConferenceData() != null
                    && event.getConferenceData().getEntryPoints() != null) {
                for (EntryPoint entryPoint : event.getConferenceData().getEntryPoints()) {
                    if ("video".equalsIgnoreCase(entryPoint.getEntryPointType())) {
                        meetingLink = entryPoint.getUri();
                        break;
                    }
                }
            }

            return MeetingDetails.builder()
                    .meetingId(event.getId())
                    .meetingLink(meetingLink)
                    .status(event.getStatus())
                    .build();

        } catch (GeneralSecurityException | IOException e) {
            log.error("Failed to retrieve Google Meet event", e);
            throw new MeetingProviderException(
                    "GOOGLE_CALENDAR",
                    "API_ERROR",
                    "Failed to retrieve Google Meet event: " + e.getMessage(),
                    e);
        }
    }

    @Override
    public String getProviderName() {
        return "Google Calendar";
    }

    @Override
    public boolean isConfigured() {
        return googleCalendarProperties.isConfigured()
                && oauthTokenManager.hasValidToken();
    }

    // Helper methods

    private Calendar buildCalendarService() throws GeneralSecurityException, IOException {
        String accessToken = oauthTokenManager.getAccessToken();
        return new Calendar.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                JSON_FACTORY,
                request -> request.getHeaders().setAuthorization("Bearer " + accessToken))
                .setApplicationName("Mentorly")
                .build();
    }

    private ConferenceData buildConferenceData() {
        ConferenceData conferenceData = new ConferenceData();
        conferenceData.setCreateRequest(new CreateConferenceRequest()
                .setRequestId("meet-" + UUID.randomUUID())
                .setConferenceSolutionKey(new ConferenceSolutionKey().setType("hangoutsMeet")));
        return conferenceData;
    }

    private EventDateTime convertToDateTime(OffsetDateTime offsetDateTime) {
        ZonedDateTime zdt = offsetDateTime.atZoneSameInstant(ZoneId.systemDefault());
        return new EventDateTime()
                .setDateTime(new DateTime(zdt.toInstant().toEpochMilli()))
                .setTimeZone(zdt.getZone().getId());
    }

    private String buildEventDescription(SkillSession session) {
        return String.format(
                "Session: %s\n\nDescription: %s\n\nMentor: %s\n\nPrice: %s\n\n"
                        + "This is an automated Google Meet session. "
                        + "Only approved participants can join.",
                session.getTitle(),
                session.getDescription() != null ? session.getDescription() : "N/A",
                session.getMentor().getFullName(),
                session.getPriceAmount());
    }
}
