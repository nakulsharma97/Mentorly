package com.mentorly.payment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Immutable data carrier for payment intent request.
 */
public record PaymentIntentRequest(
        @NotNull @Min(1) Long bookingId,
        @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
        @NotBlank String mode) {
}
