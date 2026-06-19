package com.skillswap.session;

import com.skillswap.common.ApiResponse;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.watchlist.SavedMentorRepository;
import com.skillswap.watchlist.SkillWatchlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionRepository sessionRepository;
    private final SavedMentorRepository savedMentorRepository;
    private final SkillWatchlistRepository skillWatchlistRepository;
    private final NotificationService notificationService;

    @GetMapping
    public ApiResponse<List<SkillSession>> list() {
        return new ApiResponse<>("Sessions fetched", sessionRepository.findAll());
    }

    @GetMapping("/mentor/{mentorId}")
    public ApiResponse<List<SkillSession>> listMentorSessions(@PathVariable Long mentorId) {
        List<SkillSession> sessions = sessionRepository
                .findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(mentorId, OffsetDateTime.now());
        return new ApiResponse<>("Mentor sessions fetched", sessions);
    }

    @PostMapping
    public ApiResponse<SkillSession> create(@AuthenticationPrincipal User mentor,
            @RequestBody CreateSessionRequest req) {
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle(req.title());
        session.setDescription(req.description());
        session.setSessionType(req.sessionType());
        session.setStartTime(req.startTime());
        session.setEndTime(req.endTime());
        session.setPriceAmount(req.priceAmount());
        session.setMeetingLink(req.meetingLink());
        session.setCancellationWindowHours(req.cancellationWindowHours() == null ? 24 : req.cancellationWindowHours());
        session.setRescheduleWindowHours(req.rescheduleWindowHours() == null ? 12 : req.rescheduleWindowHours());
        session.setMaxParticipants(
                req.maxParticipants() == null || req.maxParticipants() < 1 ? 1 : req.maxParticipants());
        session.setStatus(SessionStatus.PENDING);
        SkillSession saved = sessionRepository.save(session);

        Set<Long> subscriberIds = new LinkedHashSet<>();
        savedMentorRepository.findByMentorId(mentor.getId())
                .forEach(item -> subscriberIds.add(item.getLearner().getId()));

        String sessionText = (String.valueOf(saved.getTitle()) + " " + String.valueOf(saved.getSessionType()))
                .toLowerCase(Locale.ROOT);
        skillWatchlistRepository.findAll().forEach(item -> {
            if (sessionText.contains(item.getSkillName().toLowerCase(Locale.ROOT))) {
                subscriberIds.add(item.getLearner().getId());
            }
        });

        if (!subscriberIds.isEmpty()) {
            notificationService.notifyUsers(
                    subscriberIds,
                    "NEW_SESSION",
                    "New session available",
                    mentor.getFullName() + " posted a new session: " + saved.getTitle(),
                    saved.getId());
        }

        return new ApiResponse<>("Session created", saved);
    }

    @PatchMapping("/{id}/meeting-link")
    public ApiResponse<SkillSession> updateMeetingLink(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser,
            @RequestBody UpdateMeetingLinkRequest req) {
        SkillSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (!session.getMentor().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Only mentor can update meeting link");
        }

        session.setMeetingLink(req.meetingLink());
        return new ApiResponse<>("Meeting link updated", sessionRepository.save(session));
    }

    public record CreateSessionRequest(
            String title,
            String description,
            String sessionType,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            BigDecimal priceAmount,
            String meetingLink,
            Integer cancellationWindowHours,
            Integer rescheduleWindowHours,
            Integer maxParticipants) {
    }

    public record UpdateMeetingLinkRequest(String meetingLink) {
    }
}
