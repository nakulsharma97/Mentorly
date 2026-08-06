package com.skillswap.common;

import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Unit tests for {@link ProfileCompletionGuard} — the backend enforcement of
 * the mandatory profile completion flow.
 */
class ProfileCompletionGuardTest {

    private final ProfileCompletionGuard guard = new ProfileCompletionGuard();

    private static User user(UserRole role, boolean profileCompleted) {
        User user = new User();
        user.setId(1L);
        user.setRole(role);
        user.setProfileCompleted(profileCompleted);
        return user;
    }

    @Test
    void incompleteLearnerIsRejected() {
        User learner = user(UserRole.LEARNER, false);
        assertThrows(UnauthorizedException.class,
                () -> guard.requireProfileCompleted(learner, "Please complete your profile before booking sessions."));
    }

    @Test
    void incompleteMentorIsRejectedWithTheProvidedMessage() {
        User mentor = user(UserRole.MENTOR, false);
        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> guard.requireProfileCompleted(mentor, "Please complete your profile before creating sessions."));
        assertEquals("Please complete your profile before creating sessions.", ex.getMessage());
    }

    @Test
    void incompleteUserGetsDefaultMessageWhenNoneProvided() {
        User learner = user(UserRole.LEARNER, false);
        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
                () -> guard.requireProfileCompleted(learner, null));
        assertEquals("Please complete your profile before continuing.", ex.getMessage());
    }

    @Test
    void completedLearnerPasses() {
        User learner = user(UserRole.LEARNER, true);
        assertDoesNotThrow(() -> guard.requireProfileCompleted(learner, "action"));
    }

    @Test
    void completedMentorPasses() {
        User mentor = user(UserRole.MENTOR, true);
        assertDoesNotThrow(() -> guard.requireProfileCompleted(mentor, "action"));
    }

    @Test
    void adminIsAlwaysExemptEvenWhenIncomplete() {
        User admin = user(UserRole.ADMIN, false);
        assertDoesNotThrow(() -> guard.requireProfileCompleted(admin, "action"));
    }

    @Test
    void nullUserPasses() {
        assertDoesNotThrow(() -> guard.requireProfileCompleted(null, "action"));
    }
}
