package com.mentorly.meeting.provider;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Details of a meeting returned by a meeting provider.
 */
/**
 * Encapsulates meeting details.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeetingDetails {

    private String meetingId;

    private String meetingLink;

    private String conferenceId;

    private String status;

    private long durationMinutes;
}
