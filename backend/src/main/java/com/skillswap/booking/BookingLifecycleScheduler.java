package com.skillswap.booking;

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

    @Scheduled(fixedDelayString = "${app.booking.lifecycle.poll-ms:60000}")
    public void promoteConfirmedBookings() {
        int promoted = bookingLifecycleService.promoteDueBookings();
        if (promoted > 0) {
            log.info("booking_lifecycle_promoted count={}", promoted);
        }
    }
}
