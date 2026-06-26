package com.skillswap.meeting.provider;

import com.skillswap.session.SkillSession;

/**
 * Interface for meeting provider implementations.
 * This allows the application to support multiple meeting providers (Google
 * Meet, Zoom, Teams, etc.)
 * without changing the business logic.
 */
public interface MeetingProviderService {

    /**
     * Creates a meeting using the provider's API.
     *
     * @param session the session for which to create a meeting
     * @return the provider-specific meeting ID
     * @throws MeetingProviderException if meeting creation fails
     */
    String createMeeting(SkillSession session) throws MeetingProviderException;

    /**
     * Updates an existing meeting.
     *
     * @param session   the session with updated details
     * @param meetingId the provider-specific meeting ID
     * @throws MeetingProviderException if meeting update fails
     */
    void updateMeeting(SkillSession session, String meetingId) throws MeetingProviderException;

    /**
     * Deletes or cancels a meeting.
     *
     * @param meetingId the provider-specific meeting ID
     * @throws MeetingProviderException if meeting deletion fails
     */
    void deleteMeeting(String meetingId) throws MeetingProviderException;

    /**
     * Retrieves meeting details by meeting ID.
     *
     * @param meetingId the provider-specific meeting ID
     * @return meeting details including the meeting link
     * @throws MeetingProviderException if retrieval fails
     */
    MeetingDetails getMeeting(String meetingId) throws MeetingProviderException;

    /**
     * Gets the provider name.
     *
     * @return provider name
     */
    String getProviderName();

    /**
     * Checks if the provider is properly configured.
     *
     * @return true if configured with necessary credentials
     */
    boolean isConfigured();
}
