package com.skillswap.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * DTO for creating a new live session with automatic Google Meet integration.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateLiveSessionRequest {

    private String title;

    private String description;

    private String sessionType;

    private OffsetDateTime startTime;

    private OffsetDateTime endTime;

    private BigDecimal priceAmount;

    private Integer maxParticipants;

    private Integer cancellationWindowHours;

    private Integer rescheduleWindowHours;

    // Google Meet auto-generation will happen automatically in the backend
}
