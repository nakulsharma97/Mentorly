package com.skillswap.booking;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record BookingRequest(
        @NotNull @Min(1) Long sessionId) {
}