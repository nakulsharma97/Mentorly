package com.skillswap.availability;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@code UserAvailabilitySlot} persistence.
 */
public interface UserAvailabilitySlotRepository extends JpaRepository<UserAvailabilitySlot, Long> {
    List<UserAvailabilitySlot> findByUserIdAndActiveTrue(Long userId);

    Page<UserAvailabilitySlot> findByUserIdAndActiveTrue(Long userId, Pageable pageable);

    List<UserAvailabilitySlot> findByUserIdAndDayOfWeekAndActiveTrue(Long userId, Integer dayOfWeek);

    long countByUserIdAndActiveTrue(Long userId);
}
