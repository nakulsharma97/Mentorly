package com.mentorly.payment;

import jakarta.validation.constraints.NotNull;

/**
 * Immutable data carrier for update payment status request.
 */
public record UpdatePaymentStatusRequest(
        @NotNull PaymentStatus status) {
}
