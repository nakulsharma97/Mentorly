package com.skillswap.common;

public final class IdempotencyKeySupport {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 120;

    private static final String ALLOWED_PATTERN = "^[A-Za-z0-9._:-]+$";

    private IdempotencyKeySupport() {
    }

    public static void validate(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency-Key header is required");
        }
        if (idempotencyKey.length() < MIN_LENGTH || idempotencyKey.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Idempotency-Key header must be 8-120 characters");
        }
        if (!idempotencyKey.matches(ALLOWED_PATTERN)) {
            throw new IllegalArgumentException(
                    "Idempotency-Key header format is invalid (allowed: letters, numbers, . _ : -)");
        }
    }
}
