package com.mentorly.verification;

import com.mentorly.common.AdminUtils;
import com.mentorly.common.AuditLogService;
import com.mentorly.verification.MentorVerificationDtos.SubmitMentorVerificationRequest;
import com.mentorly.verification.MentorVerificationDtos.UpdateMentorVerificationStatusRequest;
import com.mentorly.mentorcertification.MentorCertificationDto;
import com.mentorly.mentorcertification.MentorCertificationService;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.notification.NotificationService;
import com.mentorly.user.AdminSubRole;
import com.mentorly.user.User;
import com.mentorly.user.UserProjectDto;
import com.mentorly.user.UserProjectService;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(MentorVerificationService.class);

    /** Frontend route where admins review the verification queue. */
    private static final String ADMIN_VERIFICATIONS_URL = "/admin/verifications";

    /** Frontend route where mentors land after an approval / rejection. */
    private static final String MENTOR_DASHBOARD_URL = "/mentor/dashboard";

    private final MentorVerificationRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final MentorCertificationService certificationService;
    private final UserProjectService userProjectService;
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
        // Verification eligibility: mentors may only apply once their profile is
        // 100% complete (the persisted flag is kept in sync by
        // ProfileCompletionService, so this is the same single source of truth).
        if (currentUser.getRole() == UserRole.MENTOR && !currentUser.isProfileCompleted()) {
            throw new IllegalArgumentException(
                    "Complete your profile before requesting verification.");
        }
        // Only allow a fresh application when the previous one was REJECTED,
        // SUSPENDED, or awaiting MORE_INFORMATION_REQUIRED (the applicant must
        // be able to revise and resubmit — per spec Step 7/8). In-progress
        // applications (PENDING / UNDER_REVIEW) and already-APPROVED mentors
        // cannot submit again — otherwise a resubmission would silently demote
        // an approved mentor to PENDING and remove them from search.
        MentorVerificationRequest latest = requestRepository
                .findFirstByMentorIdOrderByCreatedAtDesc(currentUser.getId()).orElse(null);
        if (latest != null) {
            switch (latest.getStatus()) {
                case PENDING, UNDER_REVIEW -> throw new IllegalArgumentException(
                        "You already have a verification request in progress");
                case APPROVED -> throw new IllegalArgumentException(
                        "Your mentor profile is already verified");
                default -> {
                    // REJECTED / SUSPENDED / MORE_INFORMATION_REQUIRED → resubmission allowed.
                }
            }
        }

        // Every resubmission returns to PENDING (spec Step 8) so the admin
        // queue sees the new request; a first application also starts PENDING.
        boolean resubmission = latest != null;
        MentorVerificationRequestStatus initialStatus = MentorVerificationRequestStatus.PENDING;

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
        request.setMonthsOfExperience(req.monthsOfExperience());
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
        request.setStatus(initialStatus);
        request.setSubmittedAt(OffsetDateTime.now());

        // Mirror the application onto the user's profile so the admin review
        // panel (and the public mentor profile) reflects the application.
        syncUserProfile(currentUser, req);

        // Keep the user-level verification status in sync so search / listing /
        // session / booking guards see the latest state immediately.
        OffsetDateTime now = OffsetDateTime.now();
        currentUser.setVerificationStatus(com.mentorly.user.MentorVerificationStatus.PENDING);
        currentUser.setVerificationSubmittedAt(now);
        currentUser.setVerificationReviewedAt(null);
        currentUser.setRejectionReason(null);
        currentUser.setMentorVerified(false);
        userRepository.save(currentUser);

        MentorVerificationRequest saved = requestRepository.save(request);

        // Mentor confirmation (INFO / HIGH) — covers first submission and resubmission.
        notificationService.notifyUser(
                currentUser.getId(),
                "MENTOR_VERIFICATION",
                "Verification Request Submitted",
                "Your mentor profile has been submitted successfully. Our Admin Team will review it within 24 hours.",
                saved.getId(),
                null,
                "HIGH",
                MENTOR_DASHBOARD_URL,
                "View Status",
                null);
        log.info("[Verification] Verification {} userId={} status={}",
                resubmission ? "Resubmitted" : "Submitted",
                currentUser.getId(),
                initialStatus.name());

        // Every submission (first + resubmission) alerts the admins.
        notifyAdminsOfNewRequest(currentUser, saved);

        return MentorVerificationDto.from(saved, certificationsFor(currentUser), projectsFor(currentUser));
    }

    /**
     * Auto-submission triggered by the onboarding flow: as soon as a MENTOR
     * completes their profile for the first time, a PENDING verification
     * request is created from the saved profile fields — so a mentor who is
     * blocked from creating sessions always has a request the admin can
     * review. Never duplicates an existing request and never demotes an
     * already-approved mentor.
     */
    @Transactional
    public void autoSubmitOnProfileComplete(User mentor) {
        if (mentor == null || mentor.getRole() != UserRole.MENTOR || !mentor.isProfileCompleted()) {
            return;
        }
        // Never overwrite an existing request: in-progress applications stay
        // untouched and APPROVED mentors must never be demoted.
        if (requestRepository.findFirstByMentorIdOrderByCreatedAtDesc(mentor.getId()).isPresent()) {
            log.info("[Verification] Auto-submit skipped userId={} reason=existing-request", mentor.getId());
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        MentorVerificationRequest request = new MentorVerificationRequest();
        request.setMentor(mentor);
        request.setFullName(mentor.getFullName());
        request.setEmail(mentor.getEmail());
        request.setSkills(mentor.getSkills());
        request.setYearsOfExperience(mentor.getYearsOfExperience());
        request.setMonthsOfExperience(mentor.getMonthsOfExperience());
        request.setBio(mentor.getAboutMe());
        request.setHourlyRate(mentor.getHourlyRate());
        request.setAvailability(mentor.getAvailability());
        request.setLinkedinUrl(mentor.getLinkedinUrl());
        request.setResumeUrl(mentor.getResumeUrl());
        request.setStatus(MentorVerificationRequestStatus.PENDING);
        request.setSubmittedAt(now);
        requestRepository.save(request);

        mentor.setVerificationStatus(com.mentorly.user.MentorVerificationStatus.PENDING);
        mentor.setMentorVerified(false);
        mentor.setVerificationSubmittedAt(now);
        mentor.setVerificationReviewedAt(null);
        mentor.setRejectionReason(null);
        userRepository.save(mentor);

        log.info("[Verification] Mentor Profile Completed + Verification Request Created userId={} status=PENDING",
                mentor.getId());

        // Mentor confirmation notification.
        notificationService.notifyUser(
                mentor.getId(),
                "MENTOR_VERIFICATION",
                "Verification Request Submitted",
                "Your mentor profile has been submitted for verification. Our Admin Team will review your request shortly.",
                request.getId(),
                null,
                "MEDIUM",
                MENTOR_DASHBOARD_URL,
                "View Status",
                null);

        notifyAdminsOfNewRequest(mentor, request);
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
                .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor()),
                        projectsFor(request.getMentor())))
                .toList();
    }

    /* ── Admin-facing ──────────────────────────────────────────── */

    public List<MentorVerificationDto> moderationQueue(User currentUser, MentorVerificationRequestStatus status) {
        AdminUtils.ensureAdmin(currentUser);
        List<MentorVerificationRequest> queue = requestRepository.findByStatusOrderByCreatedAtAsc(status);
        log.info("[Verification] Admin Verification API Called adminId={} status={} pendingCount={}",
                currentUser.getId(), status.name(), queue.size());
        return queue.stream()
                .map(request -> MentorVerificationDto.from(request, certificationsFor(request.getMentor()),
                        projectsFor(request.getMentor())))
                .toList();
    }

    public MentorVerificationDto requestDetail(User currentUser, Long id) {
        AdminUtils.ensureAdmin(currentUser);
        MentorVerificationRequest request = findRequest(id);
        return MentorVerificationDto.from(request, certificationsFor(request.getMentor()),
                projectsFor(request.getMentor()));
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
        OffsetDateTime now = OffsetDateTime.now();
        String decisionLabel;
        switch (nextStatus) {
            case APPROVED -> {
                mentor.setMentorVerified(true);
                mentor.setVerificationStatus(com.mentorly.user.MentorVerificationStatus.APPROVED);
                mentor.setVerifiedAt(now);
                mentor.setVerifiedBy(currentUser.getId());
                mentor.setVerificationReviewedAt(now);
                mentor.setRejectionReason(null);
                if (mentor.getRole() != UserRole.MENTOR && mentor.getRole() != UserRole.ADMIN) {
                    mentor.setRole(UserRole.MENTOR);
                }
                userRepository.save(mentor);
                emailNotificationService.sendVerificationApproved(mentor);
                decisionLabel = "Approved";
            }
            case REJECTED -> {
                mentor.setMentorVerified(false);
                mentor.setVerificationStatus(com.mentorly.user.MentorVerificationStatus.REJECTED);
                mentor.setRejectionReason(trimToNull(req.adminNote()));
                mentor.setVerificationReviewedAt(now);
                userRepository.save(mentor);
                emailNotificationService.sendVerificationRejected(mentor, request.getAdminNote());
                decisionLabel = "Rejected";
            }
            case SUSPENDED -> {
                mentor.setMentorVerified(false);
                mentor.setVerificationStatus(com.mentorly.user.MentorVerificationStatus.SUSPENDED);
                mentor.setRejectionReason(trimToNull(req.adminNote()));
                mentor.setVerificationReviewedAt(now);
                userRepository.save(mentor);
                decisionLabel = "Suspended";
            }
            case UNDER_REVIEW -> {
                mentor.setVerificationStatus(com.mentorly.user.MentorVerificationStatus.UNDER_REVIEW);
                mentor.setVerificationReviewedAt(now);
                userRepository.save(mentor);
                decisionLabel = "Moved to review";
            }
            case MORE_INFORMATION_REQUIRED -> {
                if (request.getRequestedInfo() == null) {
                    throw new IllegalArgumentException("Requested information is required for this status");
                }
                // The mentor dashboard renders a dedicated "Additional
                // Information Required" banner from this status — unless the
                // mentor is already APPROVED, in which case they stay visible.
                if (mentor.getVerificationStatus() != com.mentorly.user.MentorVerificationStatus.APPROVED) {
                    mentor.setVerificationStatus(
                            com.mentorly.user.MentorVerificationStatus.MORE_INFORMATION_REQUIRED);
                }
                mentor.setRejectionReason(null);
                mentor.setVerificationReviewedAt(now);
                userRepository.save(mentor);
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

        String notificationType = "MENTOR_VERIFICATION";
        String title;
        String message;
        String priority = "MEDIUM";
        switch (nextStatus) {
            case APPROVED -> {
                notificationType = "VERIFICATION_APPROVED";
                priority = "HIGH";
                title = "🎉 Congratulations! Your Profile Has Been Verified";
                message = "Your mentor profile has been successfully verified by the Mentorly Admin Team. "
                        + "You can now create mentoring sessions, receive learner bookings, "
                        + "appear in Explore Mentors, and start earning on Mentorly.";
                log.info("[Verification] Verification Approved adminId={} mentorId={}",
                        currentUser.getId(), mentor.getId());
            }
            case REJECTED -> {
                notificationType = "VERIFICATION_REJECTED";
                priority = "HIGH";
                title = "Profile Verification Rejected";
                // A custom message from the admin is delivered verbatim; a
                // default reason pill gets the generic guidance + the reason.
                String custom = trimToNull(req.customMessage());
                if (custom != null) {
                    message = custom;
                } else {
                    message = "Your mentor profile could not be verified at this time. "
                            + "Please review your profile, make the required changes and submit again."
                            + (request.getAdminNote() == null ? "" : " Reason: " + request.getAdminNote());
                }
                log.info("[Verification] Verification Rejected adminId={} mentorId={} reason={}",
                        currentUser.getId(), mentor.getId(), request.getAdminNote());
            }
            case SUSPENDED -> {
                notificationType = "VERIFICATION_REJECTED";
                priority = "HIGH";
                title = "Mentor Account Suspended";
                message = "Your mentor account has been suspended."
                        + (request.getAdminNote() == null ? "" : " Reason: " + request.getAdminNote());
                log.warn("[Verification] Verification Suspended adminId={} mentorId={} reason={}",
                        currentUser.getId(), mentor.getId(), request.getAdminNote());
            }
            case UNDER_REVIEW -> {
                title = "Verification under review";
                message = "Your verification application is now under review by our team.";
                log.info("[Verification] Verification Under Review adminId={} mentorId={}",
                        currentUser.getId(), mentor.getId());
            }
            case MORE_INFORMATION_REQUIRED -> {
                notificationType = "VERIFICATION_MORE_INFO";
                priority = "HIGH";
                title = "Additional Information Required";
                message = "The Admin has requested additional information before approving your profile.\n"
                        + "Required Changes:\n"
                        + (request.getRequestedInfo() == null ? "Please update your profile and resubmit."
                                : request.getRequestedInfo())
                        + "\n\nPlease update your profile and submit again.";
                log.info("[Verification] More Information Requested adminId={} mentorId={} requestedInfo={}",
                        currentUser.getId(), mentor.getId(), request.getRequestedInfo());
            }
            default -> {
                title = "Verification updated";
                message = "Your verification status changed to " + nextStatus.name() + ".";
            }
        }
        notificationService.notifyUser(
                mentor.getId(),
                notificationType,
                title,
                message,
                saved.getId(),
                null,
                priority,
                MENTOR_DASHBOARD_URL,
                "View Status",
                null);
        log.info("[Verification] Notification Created type={} mentorId={} priority={}",
                notificationType, mentor.getId(), priority);

        return MentorVerificationDto.from(saved, certificationsFor(mentor), projectsFor(mentor));
    }

    /* ── Private helpers ───────────────────────────────────────── */

    /**
     * Alerts every admin that a new (or re-submitted) verification request is
     * waiting — HIGH priority, deep-link to the review queue.
     */
    private void notifyAdminsOfNewRequest(User mentor, MentorVerificationRequest request) {
        List<User> admins = userRepository.findByRole(UserRole.ADMIN);
        if (admins.isEmpty()) {
            log.warn("[Verification] No admins found to notify for new verification request mentorId={}",
                    mentor.getId());
            return;
        }
        String submittedLabel = request.getSubmittedAt() == null
                ? "just now"
                : request.getSubmittedAt().toString().replace("T", " ").substring(0, 19);
        String username = mentor.getDisplayUsername() == null ? mentor.getEmail() : mentor.getDisplayUsername();
        String message = "A new mentor has submitted their profile for verification.\n"
                + "Mentor: " + mentor.getFullName() + " (" + username + ")\n"
                + "Submitted: " + submittedLabel;
        for (User admin : admins) {
            notificationService.notifyUser(
                    admin.getId(),
                    "MENTOR_VERIFICATION_REQUEST",
                    "New Mentor Verification Request",
                    message,
                    request.getId(),
                    null,
                    "HIGH",
                    ADMIN_VERIFICATIONS_URL,
                    "Review Request",
                    null);
        }
        log.info("[Verification] Admin Notification Created count={} requestId={}", admins.size(), request.getId());
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

    private List<UserProjectDto> projectsFor(User mentor) {
        if (mentor == null || mentor.getId() == null) {
            return List.of();
        }
        return userProjectService.listProjects(mentor);
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
        if (req.monthsOfExperience() != null) {
            user.setMonthsOfExperience(req.monthsOfExperience());
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
