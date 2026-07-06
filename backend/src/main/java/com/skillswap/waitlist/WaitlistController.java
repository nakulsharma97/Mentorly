package com.skillswap.waitlist;

import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.ApiResponse;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/waitlist")
@RequiredArgsConstructor
public class WaitlistController {

    private final SessionWaitlistRepository waitlistRepository;
    private final SessionRepository sessionRepository;
    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;

    @PostMapping("/session/{sessionId}")
    public ApiResponse<SessionWaitlist> joinWaitlist(
            @AuthenticationPrincipal User learner,
            @PathVariable Long sessionId) {
        var session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        boolean alreadyBooked = bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(
                sessionId,
                learner.getId(),
                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED, BookingStatus.RESCHEDULE_REQUESTED,
                        BookingStatus.COMPLETED));
        if (alreadyBooked) {
            throw new IllegalArgumentException("You already have a booking for this session");
        }

        waitlistRepository.findBySessionIdAndLearnerIdAndStatus(sessionId, learner.getId(), WaitlistStatus.ACTIVE)
                .ifPresent(item -> {
                    throw new IllegalArgumentException("You are already in the waitlist for this session");
                });

        SessionWaitlist request = new SessionWaitlist();
        request.setSession(session);
        request.setLearner(learner);
        request.setStatus(WaitlistStatus.ACTIVE);
        SessionWaitlist saved = waitlistRepository.save(request);

        notificationService.notifyUser(
                session.getMentor().getId(),
                "WAITLIST_JOIN",
                "Learner joined waitlist",
                learner.getFullName() + " joined waitlist for your session: " + session.getTitle(),
                saved.getId());

        return new ApiResponse<>("Joined waitlist", saved);
    }

    @GetMapping("/my")
    public ApiResponse<List<SessionWaitlist>> myWaitlist(@AuthenticationPrincipal User learner) {
        return new ApiResponse<>("Waitlist items fetched",
                waitlistRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId()));
    }
}
