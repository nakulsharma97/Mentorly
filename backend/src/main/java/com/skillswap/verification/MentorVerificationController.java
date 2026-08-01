package com.skillswap.verification;

import com.skillswap.common.AdminUtils;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.AuditLogService;
import com.skillswap.mentorcertification.MentorCertificationDto;
import com.skillswap.mentorcertification.MentorCertificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Mentor verification workflow.
 *
 * Mentor-facing: POST /request and GET /my let mentors submit and track
 * verification evidence (document, resume, certifications).
 *
 * Admin-facing: GET /requests (pending/approved/rejected queue), GET
 * /requests/{id} (full review detail) and PATCH /requests/{id}
 * (approve/reject). Approving flips {@code users.mentor_verified}, persists
 * the decision (status + admin note + reviewer audit trail), and notifies the
 * mentor via in-app notification and email. Only admins may access the
 * moderation endpoints.
 */
@RestController
@RequestMapping("/api/v1/verification/mentor")
@RequiredArgsConstructor
public class MentorVerificationController {

    private final MentorVerificationRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final MentorCertificationService certificationService;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final AuditLogService auditLogService;

    @PostMapping("/request")
    public ApiResponse<MentorVerificationDto> submit(
            @AuthenticationPrincipal User currentUser,
            @RequestBody SubmitMentorVerificationRequest req) {
        if (currentUser.getRole() != UserRole.MENTOR) {
            throw new IllegalArgumentException("Only mentors can request mentor verification");
        }
        if (requestRepository.findFirstByMentorIdAndStatusOrderByCreatedAtDesc(
                currentUser.getId(), MentorVerificationRequestStatus.PENDING).isPresent()) {
            throw new IllegalArgumentException("You already have a pending verification request");
        }
        String docUrl = normalizeHttpUrl(req.documentUrl());

        MentorVerificationRequest request = new MentorVerificationRequest();
        request.setMentor(currentUser);
        request.setDocumentUrl(docUrl);
        request.setDocumentType(req.documentType());
        request.setStatus(MentorVerificationRequestStatus.PENDING);

        MentorVerificationRequest saved = requestRepository.save(request);
        return new ApiResponse<>("Verification request submitted",
                MentorVerificationDto.from(saved, certificationsFor(currentUser)));
    }

    @GetMapping("/my")
    public ApiResponse<List<MentorVerificationDto>> myRequests(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Mentor verification requests fetched",
                requestRepository.findByMentorIdOrderByCreatedAtDesc(currentUser.getId())
                        .stream()
                        .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor())))
                        .toList());
    }

    @GetMapping("/requests")
    public ApiResponse<List<MentorVerificationDto>> moderationQueue(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") MentorVerificationRequestStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Mentor verification moderation queue fetched",
                requestRepository.findByStatusOrderByCreatedAtAsc(status)
                        .stream()
                        .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor())))
                        .toList());
    }

    @GetMapping("/requests/{id}")
    public ApiResponse<MentorVerificationDto> requestDetail(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        ensureAdmin(currentUser);
        MentorVerificationRequest request = findRequest(id);
        return new ApiResponse<>("Mentor verification request fetched",
                MentorVerificationDto.from(request, certificationsFor(request.getMentor())));
    }

    @PatchMapping("/requests/{id}")
    @Transactional
    public ApiResponse<MentorVerificationDto> updateStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UpdateMentorVerificationStatusRequest req) {
        ensureAdmin(currentUser);
        MentorVerificationRequest request = findRequest(id);

        MentorVerificationRequestStatus nextStatus = req.status();
        if (nextStatus == null) {
            throw new IllegalArgumentException("Status is required");
        }
        if (request.getStatus() == nextStatus) {
            throw new IllegalArgumentException("Verification request is already " + nextStatus.name());
        }

        request.setStatus(nextStatus);
        request.setAdminNote(trimToNull(req.adminNote()));
        request.setReviewedBy(currentUser.getId());
        request.setReviewedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());

        User mentor = request.getMentor();
        if (nextStatus == MentorVerificationRequestStatus.APPROVED) {
            mentor.setMentorVerified(true);
            userRepository.save(mentor);
            emailNotificationService.sendVerificationApproved(mentor);
        } else if (nextStatus == MentorVerificationRequestStatus.REJECTED) {
            mentor.setMentorVerified(false);
            userRepository.save(mentor);
            emailNotificationService.sendVerificationRejected(mentor, request.getAdminNote());
        }

        MentorVerificationRequest saved = requestRepository.save(request);

        // Admin audit trail: who reviewed, which mentor, the decision, and when.
        // Wrapped so a failed audit insert never fails the verification decision.
        try {
            auditLogService.logAdmin(currentUser, "MENTOR_VERIFICATION", "MentorVerificationRequest", id,
                    (nextStatus == MentorVerificationRequestStatus.APPROVED ? "Approved" : "Rejected")
                            + " mentor verification for \"" + mentor.getFullName() + "\" ("
                            + mentor.getEmail() + ")"
                            + (request.getAdminNote() == null ? "" : " — " + request.getAdminNote()));
        } catch (Exception ignored) {
            // Audit must never fail the verification decision.
        }

        notificationService.notifyUser(
                mentor.getId(),
                "MENTOR_VERIFICATION",
                nextStatus == MentorVerificationRequestStatus.APPROVED
                        ? "Mentor verification approved"
                        : "Mentor verification rejected",
                nextStatus == MentorVerificationRequestStatus.APPROVED
                        ? "Congratulations! Your mentor profile has been verified. A verified badge now appears on your profile."
                        : "Your mentor verification request was not approved." +
                        (request.getAdminNote() == null ? "" : " Reason: " + request.getAdminNote()),
                saved.getId());

        return new ApiResponse<>("Mentor verification request updated",
                MentorVerificationDto.from(saved, certificationsFor(mentor)));
    }

    private MentorVerificationRequest findRequest(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Verification request not found"));
    }

    private List<MentorCertificationDto> certificationsFor(User mentor) {
        if (mentor == null || mentor.getId() == null) {
            return List.of();
        }
        return certificationService.listForMentor(mentor.getId());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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

    private static void ensureAdmin(User currentUser, AdminSubRole... requiredSubRole) {
        AdminUtils.ensureAdmin(currentUser, requiredSubRole);
    }

    public record SubmitMentorVerificationRequest(String documentUrl, String documentType) {
    }

    public record UpdateMentorVerificationStatusRequest(MentorVerificationRequestStatus status, String adminNote) {
    }
}
