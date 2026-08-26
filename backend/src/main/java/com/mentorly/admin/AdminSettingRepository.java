package com.mentorly.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

/**
 * Spring Data repository for {@code AdminSetting} persistence.
 */
public interface AdminSettingRepository extends JpaRepository<AdminSetting, Long> {
    Optional<AdminSetting> findBySettingKey(String settingKey);

    void deleteBySettingKeyIn(Collection<String> settingKeys);
}
