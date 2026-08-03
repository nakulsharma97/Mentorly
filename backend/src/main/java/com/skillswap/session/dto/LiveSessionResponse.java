package com.skillswap.session.dto;

import com.skillswap.session.LiveSessionStatus;
import com.skillswap.session.MeetingProvider;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * DTO for live session response.
 * The meeting link is NEVER exposed in normal session responses.
 * It's only returned through the secure join endpoint after authorization.
 */
/**
 * Encapsulates live session response.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveSessionResponse {

    private Long id;

    private Long mentorId;

    private String mentorName;

    private String mentorUsername;

    private String title;

    private String description;

    private String sessionType;

    private OffsetDateTime startTime;

    private OffsetDateTime endTime;

    private BigDecimal priceAmount;

    private Integer maxParticipants;

    private Integer currentParticipants;

    private Integer cancellationWindowHours;

    private Integer rescheduleWindowHours;

    private LiveSessionStatus status;

    private MeetingProvider meetingProvider;

    private boolean meetingGenerated;

    // Approval status (for admin)
    private Integer approvedCount;

    private Integer rejectedCount;

    private Integer pendingCount;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    // Note: meetingLink is INTENTIONALLY NOT included in this DTO
    // It's only returned from the secure join endpoint
}
