package com.skillswap.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IdempotencyKeySupportTest {

    @Test
    void validateAcceptsWellFormedKey() {
        assertDoesNotThrow(() -> IdempotencyKeySupport.validate("booking-1234_ABC"));
    }

    @Test
    void validateRejectsMissingKey() {
        assertThrows(IllegalArgumentException.class, () -> IdempotencyKeySupport.validate(null));
    }

    @Test
    void validateRejectsTooShortKey() {
        assertThrows(IllegalArgumentException.class, () -> IdempotencyKeySupport.validate("short"));
    }

    @Test
    void validateRejectsInvalidCharacters() {
        assertThrows(IllegalArgumentException.class, () -> IdempotencyKeySupport.validate("bad key!"));
    }
}
