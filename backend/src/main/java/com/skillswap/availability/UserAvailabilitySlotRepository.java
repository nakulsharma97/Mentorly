package com.skillswap.availability;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserAvailabilitySlotRepository extends JpaRepository<UserAvailabilitySlot, Long> {
    List<UserAvailabilitySlot> findByUserIdAndActiveTrue(Long userId);

    List<UserAvailabilitySlot> findByUserIdAndDayOfWeekAndActiveTrue(Long userId, Integer dayOfWeek);

    long countByUserIdAndActiveTrue(Long userId);
}
