package com.skillswap.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminNotifPreferenceRepository extends JpaRepository<AdminNotifPreference, Long> {
    Optional<AdminNotifPreference> findByPrefKey(String prefKey);

    void deleteByPrefKeyIn(java.util.Collection<String> prefKeys);
}
