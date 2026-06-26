package com.skillswap.booking;

/**
 * Enum for payment status of a booking.
 */
public enum PaymentStatus {
    PENDING("pending"),
    COMPLETED("completed"),
    REFUNDED("refunded"),
    FAILED("failed");

    private final String code;

    PaymentStatus(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public boolean isCompleted() {
        return this == COMPLETED;
    }
}
