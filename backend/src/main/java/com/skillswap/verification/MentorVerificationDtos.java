package com.skillswap.verification;

import com.skillswap.user.User;

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
     */
    public record UpdateMentorVerificationStatusRequest(
            MentorVerificationRequestStatus status,
            String adminNote,
            String requestedInfo) {
    }

    /**
     * Curated status summary for the applicant's dashboard banner.
     */
    public record MentorVerificationStatusDto(
            Long requestId,
            String status,
            String requestedInfo,
            String adminNote,
            boolean mentorVerified) {

        static MentorVerificationStatusDto from(MentorVerificationRequest latest, User user) {
            return new MentorVerificationStatusDto(
                    latest == null ? null : latest.getId(),
                    latest == null ? null : latest.getStatus() == null ? null : latest.getStatus().name(),
                    latest == null ? null : latest.getRequestedInfo(),
                    latest == null ? null : latest.getAdminNote(),
                    user.isMentorVerified());
        }
    }
}
