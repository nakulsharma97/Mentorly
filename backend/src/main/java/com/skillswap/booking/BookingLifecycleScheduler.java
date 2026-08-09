package com.skillswap.booking;

import com.skillswap.common.SchedulerLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Encapsulates booking lifecycle scheduler.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingLifecycleScheduler {

    private final BookingLifecycleService bookingLifecycleService;
    private final SchedulerLockService schedulerLockService;

    @Scheduled(fixedDelayString = "${app.booking.lifecycle.poll-ms:60000}")
    public void promoteConfirmedBookings() {
        // Leader lock: with multiple app instances (k8s replicas) only one pod
        // may promote due bookings, otherwise sessions get double-promoted and
        // duplicate emails/notifications are sent.
        schedulerLockService.runIfLeader("booking-lifecycle-promote", () -> {
            int promoted = bookingLifecycleService.promoteDueBookings();
            if (promoted > 0) {
                log.info("booking_lifecycle_promoted count={}", promoted);
            }
        });
    }
}
