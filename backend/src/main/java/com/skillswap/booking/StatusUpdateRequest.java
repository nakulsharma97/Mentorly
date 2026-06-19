package com.skillswap.booking;

import jakarta.validation.constraints.NotNull;

public record StatusUpdateRequest(
        @NotNull BookingStatus status) {
}