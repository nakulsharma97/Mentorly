package com.skillswap.booking;

import jakarta.validation.constraints.NotNull;

/**
 * Immutable data carrier for status update request.
 */
public record StatusUpdateRequest(
        @NotNull BookingStatus status) {
}
