package com.skillswap.verification;

import com.skillswap.mentorcertification.MentorCertificationDto;
import com.skillswap.user.User;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Admin-facing view of a mentor verification request.
 *
 * Unlike returning the raw {@link MentorVerificationRequest} entity (which
 * would serialize the {@link User} entity — including the password hash —
 * directly to the client), this DTO exposes only the fields the admin review
 * workflow needs: the request itself, a curated mentor profile summary
 * (certificates, resume, experience, etc.), and the mentor's structured
 * certifications for evidence review.
 */
public record MentorVerificationDto(
        Long id,
        String status,
        String documentUrl,
        String documentType,
        String adminNote,
        Long reviewedBy,
        String reviewedAt,
        String createdAt,
        String updatedAt,
        MentorSummaryDto mentor,
        List<MentorCertificationDto> certifications) {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    public static MentorVerificationDto from(
            MentorVerificationRequest request,
            List<MentorCertificationDto> certifications) {
        return new MentorVerificationDto(
                request.getId(),
                request.getStatus() == null ? null : request.getStatus().name(),
                request.getDocumentUrl(),
                request.getDocumentType(),
                request.getAdminNote(),
                request.getReviewedBy(),
                format(request.getReviewedAt()),
                format(request.getCreatedAt()),
                format(request.getUpdatedAt()),
                MentorSummaryDto.from(request.getMentor()),
                certifications);
    }

    private static String format(OffsetDateTime value) {
        return value == null ? null : value.format(FORMATTER);
    }

    /**
     * Curated mentor profile summary for the review workflow. Explicitly omits
     * sensitive account data such as the password hash, tokens, and wallet.
     */
    public record MentorSummaryDto(
            Long id,
            String email,
            String username,
            String fullName,
            String profileImageUrl,
            String headline,
            String company,
            Integer yearsOfExperience,
            String skills,
            String aboutMe,
            String githubUrl,
            String linkedinUrl,
            String resumeUrl,
            String certificates,
            String verifiedSkills,
            String projects,
            String pastTeachingSessions,
            String languages,
            String hourlyRate,
            boolean mentorVerified,
            String createdAt) {

        static MentorSummaryDto from(User user) {
            return new MentorSummaryDto(
                    user.getId(),
                    user.getEmail(),
                    user.getDisplayUsername(),
                    user.getFullName(),
                    user.getProfileImageUrl(),
                    user.getHeadline(),
                    user.getCompany(),
                    user.getYearsOfExperience(),
                    user.getSkills(),
                    user.getAboutMe(),
                    user.getGithubUrl(),
                    user.getLinkedinUrl(),
                    user.getResumeUrl(),
                    user.getCertificates(),
                    user.getVerifiedSkills(),
                    user.getProjects(),
                    user.getPastTeachingSessions(),
                    user.getLanguages(),
                    user.getHourlyRate() == null ? null : user.getHourlyRate().toPlainString(),
                    user.isMentorVerified(),
                    user.getCreatedAt() == null ? null : user.getCreatedAt().format(FORMATTER));
        }
    }
}
