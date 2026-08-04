package com.skillswap.verification;

import com.skillswap.common.AdminUtils;
import com.skillswap.common.AuditLogService;
import com.skillswap.verification.MentorVerificationDtos.SubmitMentorVerificationRequest;
import com.skillswap.verification.MentorVerificationDtos.UpdateMentorVerificationStatusRequest;
import com.skillswap.mentorcertification.MentorCertificationDto;
import com.skillswap.mentorcertification.MentorCertificationService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Mentor verification workflow — the single source of truth for creating and
 * reviewing mentor applications.
 *
 * <p><b>Submission:</b> any authenticated learner (or existing mentor) can
 * apply to become a verified mentor. A snapshot of the application form is
 * stored on the request itself and mirrored onto the user profile so the
 * admin review panel sees exactly what was submitted. Duplicate PENDING
 * applications are rejected; after a REJECTED or MORE_INFORMATION_REQUIRED
 * decision the applicant may re-apply.
 *
 * <p><b>Approval:</b> flips {@code mentor_verified}, promotes the user role to
 * {@code MENTOR} (unless already a mentor/admin), notifies the user by
 * in-app notification + email, and writes an admin audit trail.
 *
 * <p><b>More information:</b> stores what the admin requested so the
 * applicant can revise and resubmit.
 */
@Service
@RequiredArgsConstructor
public class MentorVerificationService {

    private final MentorVerificationRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final MentorCertificationService certificationService;
    private final NotificationService notificationService;
    private final EmailNotificationService emailNotificationService;
    private final AuditLogService auditLogService;

    /* ── Mentor-facing ─────────────────────────────────────────── */

    /**
     * Submit (or re-submit) a mentor application. Any non-admin user may
     * apply; the previous PENDING gate prevents duplicate open applications.
     */
    @Transactional
    public MentorVerificationDto submit(User currentUser, SubmitMentorVerificationRequest req) {
        if (currentUser.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admins cannot apply to become a mentor");
        }
        requestRepository.findFirstByMentorIdAndStatusOrderByCreatedAtDesc(
                        currentUser.getId(), MentorVerificationRequestStatus.PENDING)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("You already have a pending verification request");
                });

        // Identity proof is optional — the resume URL doubles as evidence when
        // no separate document is provided. At least one URL is expected so the
        // admin has something to review.
        String submittedDocumentUrl = trimToNull(req.documentUrl());
        String documentUrl = submittedDocumentUrl != null
                ? normalizeHttpUrl(submittedDocumentUrl)
                : normalizeOptionalHttpUrl(req.resumeUrl());
        String documentType = trimToNull(req.documentType());
        if (documentType == null && documentUrl != null) {
            documentType = submittedDocumentUrl != null ? "identity_proof" : "resume";
        }

        MentorVerificationRequest request = new MentorVerificationRequest();
        request.setMentor(currentUser);
        request.setFullName(trimToNull(req.fullName()));
        request.setEmail(trimToNull(req.email()));
        request.setSkills(trimToNull(req.skills()));
        request.setYearsOfExperience(req.yearsOfExperience());
        request.setBio(trimToNull(req.aboutMe()));
        request.setResumeUrl(normalizeOptionalHttpUrl(req.resumeUrl()));
        request.setCertificateUrls(trimToNull(req.certificateUrls()));
        request.setLinkedinUrl(normalizeOptionalHttpUrl(req.linkedinUrl()));
        request.setGithubUrl(normalizeOptionalHttpUrl(req.githubUrl()));
        request.setPortfolioUrl(normalizeOptionalHttpUrl(req.portfolioUrl()));
        request.setHourlyRate(req.hourlyRate());
        request.setAvailability(trimToNull(req.availability()));
        request.setDocumentUrl(documentUrl);
        request.setDocumentType(documentType);
        request.setStatus(MentorVerificationRequestStatus.PENDING);
        request.setSubmittedAt(OffsetDateTime.now());

        // Mirror the application onto the user's profile so the admin review
        // panel (and the public mentor profile) reflects the application.
        syncUserProfile(currentUser, req);
        userRepository.save(currentUser);

        MentorVerificationRequest saved = requestRepository.save(request);

        notificationService.notifyUser(
                currentUser.getId(),
                "MENTOR_VERIFICATION",
                "Application submitted",
                "Your mentor verification application is now pending review.",
                saved.getId());

        return MentorVerificationDto.from(saved, certificationsFor(currentUser));
    }

    /**
     * Latest verification state for the current user (feeds the mentor
     * dashboard status banner). Returns null when the user has never applied.
     */
    public MentorVerificationRequest latestFor(User user) {
        return requestRepository.findFirstByMentorIdOrderByCreatedAtDesc(user.getId()).orElse(null);
    }

    public List<MentorVerificationDto> myRequests(User user) {
        return requestRepository.findByMentorIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor())))
                .toList();
    }

    /* ── Admin-facing ──────────────────────────────────────────── */

    public List<MentorVerificationDto> moderationQueue(User currentUser, MentorVerificationRequestStatus status) {
        AdminUtils.ensureAdmin(currentUser);
        return requestRepository.findByStatusOrderByCreatedAtAsc(status)
                .stream()
                .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor())))
                .toList();
    }

    public MentorVerificationDto requestDetail(User currentUser, Long id) {
        AdminUtils.ensureAdmin(currentUser);
        MentorVerificationRequest request = findRequest(id);
        return MentorVerificationDto.from(request, certificationsFor(request.getMentor()));
    }

    /**
     * Approve / reject / request more information. Approval promotes the user
     * to the MENTOR role and enables mentor dashboard access.
     */
    @Transactional
    public MentorVerificationDto updateStatus(
            User currentUser,
            Long id,
            UpdateMentorVerificationStatusRequest req) {
        AdminUtils.ensureAdmin(currentUser);
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
        request.setRequestedInfo(trimToNull(req.requestedInfo()));
        request.setReviewedBy(currentUser.getId());
        request.setReviewedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());

        User mentor = request.getMentor();
        String decisionLabel;
        switch (nextStatus) {
            case APPROVED -> {
                mentor.setMentorVerified(true);
                if (mentor.getRole() != UserRole.MENTOR && mentor.getRole() != UserRole.ADMIN) {
                    mentor.setRole(UserRole.MENTOR);
                }
                userRepository.save(mentor);
                emailNotificationService.sendVerificationApproved(mentor);
                decisionLabel = "Approved";
            }
            case REJECTED -> {
                mentor.setMentorVerified(false);
                userRepository.save(mentor);
                emailNotificationService.sendVerificationRejected(mentor, request.getAdminNote());
                decisionLabel = "Rejected";
            }
            case MORE_INFORMATION_REQUIRED -> {
                if (request.getRequestedInfo() == null) {
                    throw new IllegalArgumentException("Requested information is required for this status");
                }
                decisionLabel = "Requested more information";
            }
            default -> decisionLabel = nextStatus.name();
        }

        MentorVerificationRequest saved = requestRepository.save(request);

        // Admin audit trail — wrapped so a failed audit insert never fails the decision.
        try {
            auditLogService.logAdmin(currentUser, "MENTOR_VERIFICATION", "MentorVerificationRequest", id,
                    decisionLabel + " mentor verification for \"" + mentor.getFullName() + "\" ("
                            + mentor.getEmail() + ")"
                            + (request.getAdminNote() == null ? "" : " — " + request.getAdminNote()));
        } catch (Exception ignored) {
            // Audit must never fail the verification decision.
        }

        String title;
        String message;
        switch (nextStatus) {
            case APPROVED -> {
                title = "Mentor verification approved";
                message = "Congratulations! Your mentor profile has been verified. "
                        + "You now have access to your mentor dashboard.";
            }
            case REJECTED -> {
                title = "Mentor verification rejected";
                message = "Your mentor verification request was not approved."
                        + (request.getAdminNote() == null ? "" : " Reason: " + request.getAdminNote());
            }
            case MORE_INFORMATION_REQUIRED -> {
                title = "More information requested";
                message = "The admin needs more information to finish reviewing your application."
                        + (request.getRequestedInfo() == null ? "" : " " + request.getRequestedInfo())
                        + " Please revise and resubmit your application.";
            }
            default -> {
                title = "Verification updated";
                message = "Your verification status changed to " + nextStatus.name() + ".";
            }
        }
        notificationService.notifyUser(mentor.getId(), "MENTOR_VERIFICATION", title, message, saved.getId());

        return MentorVerificationDto.from(saved, certificationsFor(mentor));
    }

    /* ── Private helpers ───────────────────────────────────────── */

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

    private void syncUserProfile(User user, SubmitMentorVerificationRequest req) {
        if (req.fullName() != null && !req.fullName().isBlank()) {
            user.setFullName(req.fullName().trim());
        }
        if (req.headline() != null && !req.headline().isBlank()) {
            user.setHeadline(req.headline().trim());
        }
        if (req.skills() != null && !req.skills().isBlank()) {
            user.setSkills(req.skills().trim());
        }
        if (req.yearsOfExperience() != null) {
            user.setYearsOfExperience(req.yearsOfExperience());
        }
        if (req.aboutMe() != null && !req.aboutMe().isBlank()) {
            user.setAboutMe(req.aboutMe().trim());
        }
        if (req.hourlyRate() != null) {
            user.setHourlyRate(req.hourlyRate());
        }
        if (req.linkedinUrl() != null && !req.linkedinUrl().isBlank()) {
            user.setLinkedinUrl(req.linkedinUrl().trim());
        }
        if (req.githubUrl() != null && !req.githubUrl().isBlank()) {
            user.setGithubUrl(req.githubUrl().trim());
        }
        if (req.resumeUrl() != null && !req.resumeUrl().isBlank()) {
            user.setResumeUrl(req.resumeUrl().trim());
        }
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
        return requireHttpUrl(normalized);
    }

    private static String normalizeOptionalHttpUrl(String value) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        return requireHttpUrl(normalized);
    }

    private static String requireHttpUrl(String normalized) {
        String lower = normalized.toLowerCase();
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new IllegalArgumentException("URL must start with http:// or https://");
        }
        return normalized;
    }
}
