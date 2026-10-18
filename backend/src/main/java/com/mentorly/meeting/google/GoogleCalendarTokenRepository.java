package com.mentorly.meeting.google;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code GoogleCalendarToken} persistence.
 */
public interface GoogleCalendarTokenRepository extends JpaRepository<GoogleCalendarToken, Long> {

    Optional<GoogleCalendarToken> findByAccountKey(String accountKey);
}
