package com.mentorly.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Persistence-level tests for admin user deletion.
 *
 * <p>Regression guard for "deleted user reappears after refresh": deletion is a
 * soft delete ({@code users.deleted_at}), so the admin list query must exclude
 * deleted rows while still returning disabled (not deleted) accounts.
 */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class UserRepositorySoftDeleteTest {

    @Autowired
    private UserRepository userRepository;

    private User persist(String username, boolean enabled, OffsetDateTime deletedAt) {
        User user = new User();
        user.setEmail(username + "@mentorly.test");
        user.setUsername(username);
        user.setUsernameLower(username.toLowerCase());
        user.setPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
        user.setFullName("User " + username);
        user.setRole(UserRole.LEARNER);
        user.setEnabled(enabled);
        user.setEmailVerified(true);
        user.setCreatedAt(OffsetDateTime.now());
        user.setLastActiveAt(OffsetDateTime.now());
        user.setDeletedAt(deletedAt);
        return userRepository.saveAndFlush(user);
    }

    private PageRequest firstPage() {
        return PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @Test
    void adminListExcludesDeletedUsersButKeepsDisabledOnes() {
        User active = persist("active", true, null);
        User disabled = persist("disabled", false, null);
        User deleted = persist("deleted", false, OffsetDateTime.now());

        Page<User> page = userRepository.findByFilters(null, null, firstPage());

        assertTrue(page.getContent().stream().anyMatch(u -> u.getId().equals(active.getId())));
        assertTrue(page.getContent().stream().anyMatch(u -> u.getId().equals(disabled.getId())),
                "a disabled account is not a deleted account and must stay visible");
        assertFalse(page.getContent().stream().anyMatch(u -> u.getId().equals(deleted.getId())),
                "a soft-deleted account must not come back in the admin list");
        assertEquals(2, page.getTotalElements());
    }

    @Test
    void searchingForADeletedUserDoesNotResurrectIt() {
        persist("active", true, null);
        persist("ghost", false, OffsetDateTime.now());

        Page<User> byName = userRepository.findByFilters(null, "[Deleted User]", firstPage());
        Page<User> byEmail = userRepository.findByFilters(null, "ghost@mentorly.test", firstPage());
        Page<User> byUsername = userRepository.findByFilters(null, "ghost", firstPage());

        assertTrue(byName.isEmpty());
        assertTrue(byEmail.isEmpty());
        assertTrue(byUsername.isEmpty());
    }

    @Test
    void roleFilterStillExcludesDeletedUsers() {
        persist("learner-live", true, null);
        User mentor = persist("mentor-deleted", false, OffsetDateTime.now());
        mentor.setRole(UserRole.MENTOR);
        userRepository.saveAndFlush(mentor);

        Page<User> mentors = userRepository.findByFilters(UserRole.MENTOR, null, firstPage());

        assertTrue(mentors.isEmpty());
    }

    @Test
    void deletedAtIsPersistedAndNotNullAfterReload() {
        User user = persist("tobedeleted", true, null);
        assertNull(user.getDeletedAt());

        user.setDeletedAt(OffsetDateTime.now());
        user.setEnabled(false);
        userRepository.saveAndFlush(user);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();

        assertNotNull(reloaded.getDeletedAt());
        assertFalse(reloaded.isEnabled());
    }
}
