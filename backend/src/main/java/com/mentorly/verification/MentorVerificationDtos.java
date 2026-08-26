package com.mentorly.verification;

import com.mentorly.user.User;

import java.math.BigDecimal;

/**
 * Request/status data carriers for the mentor verification workflow.
 * Kept separate from {@link MentorVerificationRequest} (the JPA entity) and
 * {@link MentorVerificationDto} (the admin review view) so the service and
 * controller share the same shapes.
 */
public final class MentorVerificationDtos {

    private MentorVerificationDtos() {
        // Utility holder - no instantiation
    }

    /**
     * Immutable data carrier for a mentor verification application. Every
     * field maps to the "Become a Mentor" form.
     */
    public record SubmitMentorVerificationRequest(
            String fullName,
            String email,
            String headline,
            String skills,
            Integer yearsOfExperience,
            Integer monthsOfExperience,
            String aboutMe,
            BigDecimal hourlyRate,
            String linkedinUrl,
            String githubUrl,
            String portfolioUrl,
            String resumeUrl,
            String certificateUrls,
            String documentUrl,
            String documentType,
            String availability) {
    }

    /**
     * Immutable data carrier for updating verification status.
     *
     * @param adminNote the rejection/suspension reason (or a short note)
     * @param customMessage when rejecting, an admin-authored message that is
     *                      delivered to the mentor verbatim (falls back to a
     *                      generic message + reason when null)
     */
    public record UpdateMentorVerificationStatusRequest(
            MentorVerificationRequestStatus status,
            String adminNote,
            String requestedInfo,
            String customMessage) {
    }

    /**
     * Curated status summary for the applicant's dashboard banner.
     */
    public record MentorVerificationStatusDto(
            Long requestId,
            String status,
            String requestedInfo,
            String adminNote,
            boolean mentorVerified,
            // User-level state (kept in sync with the latest request) so the
            // dashboard banner can distinguish PENDING / UNDER_REVIEW / REJECTED
            // (with reason) / SUSPENDED without extra round-trips.
            String verificationStatus,
            String rejectionReason,
            String submittedAt,
            String verifiedAt,
            boolean profileCompleted) {

        static MentorVerificationStatusDto from(MentorVerificationRequest latest, User user) {
            return new MentorVerificationStatusDto(
                    latest == null ? null : latest.getId(),
                    latest == null ? null : latest.getStatus() == null ? null : latest.getStatus().name(),
                    latest == null ? null : latest.getRequestedInfo(),
                    latest == null ? null : latest.getAdminNote(),
                    user.isMentorVerified(),
                    user.getVerificationStatus() == null ? null : user.getVerificationStatus().name(),
                    user.getRejectionReason(),
                    user.getVerificationSubmittedAt() == null ? null : user.getVerificationSubmittedAt().toString(),
                    user.getVerifiedAt() == null ? null : user.getVerifiedAt().toString(),
                    user.isProfileCompleted());
        }
    }
}
