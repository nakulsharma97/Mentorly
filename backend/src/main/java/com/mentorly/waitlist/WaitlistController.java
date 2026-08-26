package com.mentorly.waitlist;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.common.ApiResponse;
import com.mentorly.notification.NotificationService;
import com.mentorly.session.SessionRepository;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing waitlist endpoints.
 */
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
    public ApiResponse<Page<SessionWaitlist>> myWaitlist(
            @AuthenticationPrincipal User learner,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return new ApiResponse<>("Waitlist items fetched",
                waitlistRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId(), PageRequest.of(page, Math.min(size, 50))));
    }
}
