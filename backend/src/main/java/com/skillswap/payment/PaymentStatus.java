package com.skillswap.payment;

/**
 * Enumerates payment status.
 */
public enum PaymentStatus {
    PENDING,
    INITIATED,
    ESCROWED,
    RELEASED,
    COMPLETED,
    REFUNDED,
    FAILED;

    public boolean isCompleted() {
        return this == COMPLETED;
    }
}
