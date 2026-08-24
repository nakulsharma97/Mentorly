package com.skillswap.booking;

import com.skillswap.common.SchedulerLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${app.booking.completion-confirm-timeout-hours:24}")
    private long completionConfirmTimeoutHours;

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

    /**
     * Periodically check for IN_PROGRESS sessions whose end time has passed
     * and initiate the dual-confirmation flow. Also escalates stale
     * AWAITING_CONFIRMATION bookings to REVIEW_REQUIRED after the timeout.
     */
    @Scheduled(fixedDelayString = "${app.booking.completion-check-poll-ms:120000}")
    public void checkSessionCompletions() {
        schedulerLockService.runIfLeader("booking-completion-confirm", () -> {
            int initiated = bookingLifecycleService.initiateCompletionConfirmations();
            if (initiated > 0) {
                log.info("session_completion_initiated count={}", initiated);
            }
            int escalated = bookingLifecycleService.checkAwaitingConfirmations(completionConfirmTimeoutHours);
            if (escalated > 0) {
                log.info("session_completion_escalated count={}", escalated);
            }
        });
    }
}
