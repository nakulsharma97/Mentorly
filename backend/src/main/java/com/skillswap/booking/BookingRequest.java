package com.skillswap.booking;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Immutable data carrier for booking request.
 */
public record BookingRequest(
        @NotNull @Min(1) Long sessionId) {
}
