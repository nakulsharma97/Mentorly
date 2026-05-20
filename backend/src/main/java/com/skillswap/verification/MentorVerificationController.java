package com.skillswap.verification;

import com.skillswap.common.ApiResponse;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/verification/mentor")
@RequiredArgsConstructor
public class MentorVerificationController {

    private final MentorVerificationRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @PostMapping("/request")
    public ApiResponse<MentorVerificationRequest> submit(
            @AuthenticationPrincipal User currentUser,
            @RequestBody SubmitMentorVerificationRequest req) {
        if (currentUser.getRole() != UserRole.MENTOR) {
            throw new IllegalArgumentException("Only mentors can request mentor verification");
        }
        String docUrl = normalizeHttpUrl(req.documentUrl());

        MentorVerificationRequest request = new MentorVerificationRequest();
        request.setMentor(currentUser);
        request.setDocumentUrl(docUrl);
        request.setDocumentType(req.documentType());
        request.setStatus(MentorVerificationRequestStatus.PENDING);

        return new ApiResponse<>("Verification request submitted", requestRepository.save(request));
    }

    @GetMapping("/my")
    public ApiResponse<List<MentorVerificationRequest>> myRequests(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Mentor verification requests fetched",
                requestRepository.findByMentorIdOrderByCreatedAtDesc(currentUser.getId()));
    }

    @GetMapping("/requests")
    public ApiResponse<List<MentorVerificationRequest>> moderationQueue(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") MentorVerificationRequestStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Mentor verification moderation queue fetched",
                requestRepository.findByStatusOrderByCreatedAtAsc(status));
    }

    @PatchMapping("/requests/{id}")
    public ApiResponse<MentorVerificationRequest> updateStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateMentorVerificationStatusRequest req) {
        ensureAdmin(currentUser);
        MentorVerificationRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Verification request not found"));

        request.setStatus(req.status());
        request.setAdminNote(req.adminNote());
        request.setUpdatedAt(OffsetDateTime.now());

        if (req.status() == MentorVerificationRequestStatus.APPROVED) {
            User mentor = request.getMentor();
            mentor.setMentorVerified(true);
            userRepository.save(mentor);
        }

        MentorVerificationRequest saved = requestRepository.save(request);
        notificationService.notifyUser(
                saved.getMentor().getId(),
                "MENTOR_VERIFICATION",
                "Verification request updated",
                "Your mentor verification request is now " + saved.getStatus().name(),
                saved.getId());

        return new ApiResponse<>("Mentor verification request updated", saved);
    }

    private static String normalizeHttpUrl(String value) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank()) {
            throw new IllegalArgumentException("Document URL is required");
        }
        String lower = normalized.toLowerCase();
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new IllegalArgumentException("Document URL must start with http:// or https://");
        }
        return normalized;
    }

    private static void ensureAdmin(User currentUser) {
        if (currentUser.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only admins can review mentor verification requests");
        }
    }

    public record SubmitMentorVerificationRequest(String documentUrl, String documentType) {
    }

    public record UpdateMentorVerificationStatusRequest(MentorVerificationRequestStatus status, String adminNote) {
    }
}
