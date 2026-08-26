package com.mentorly.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code AdminNotifPreference} persistence.
 */
public interface AdminNotifPreferenceRepository extends JpaRepository<AdminNotifPreference, Long> {
    Optional<AdminNotifPreference> findByPrefKey(String prefKey);

    void deleteByPrefKeyIn(java.util.Collection<String> prefKeys);
}
