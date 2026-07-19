package com.skillswap.session.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @NotBlank(message = "Session type is required")
    private String sessionType;

    @NotNull(message = "Start time is required")
    @Future(message = "Start time must be in the future")
    private OffsetDateTime startTime;

    @NotNull(message = "End time is required")
    @Future(message = "End time must be in the future")
    private OffsetDateTime endTime;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.01", message = "Price must be at least 0.01")
    private BigDecimal priceAmount;

    @Min(value = 1, message = "Max participants must be at least 1")
    private Integer maxParticipants;

    @Min(value = 0, message = "Cancellation window cannot be negative")
    private Integer cancellationWindowHours;

    @Min(value = 0, message = "Reschedule window cannot be negative")
    private Integer rescheduleWindowHours;

    // Google Meet auto-generation will happen automatically in the backend
}
