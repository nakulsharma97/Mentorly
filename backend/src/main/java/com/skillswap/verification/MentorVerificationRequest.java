package com.skillswap.verification;

import com.skillswap.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Encapsulates mentor verification request.
 */
@Getter
@Setter
@Entity
@Table(name = "mentor_verification_requests")
public class MentorVerificationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "mentor_id", nullable = false)
    private User mentor;

    /** Applicant snapshot — name at submission time (may differ from current profile). */
    @Column(name = "full_name")
    private String fullName;

    /** Applicant snapshot — email at submission time. */
    @Column(name = "email")
    private String email;

    @Column(name = "skills", columnDefinition = "TEXT")
    private String skills;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "bio", columnDefinition = "TEXT")
    private String bio;

    @Column(name = "resume_url", length = 1000)
    private String resumeUrl;

    @Column(name = "certificate_urls", columnDefinition = "TEXT")
    private String certificateUrls;

    @Column(name = "linkedin_url", length = 500)
    private String linkedinUrl;

    @Column(name = "github_url", length = 500)
    private String githubUrl;

    @Column(name = "portfolio_url", length = 500)
    private String portfolioUrl;

    @Column(name = "hourly_rate")
    private BigDecimal hourlyRate;

    @Column(name = "availability", length = 255)
    private String availability;

    @Column(name = "document_url")
    private String documentUrl;

    @Column(name = "document_type")
    private String documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MentorVerificationRequestStatus status = MentorVerificationRequestStatus.PENDING;

    @Column(name = "admin_note")
    private String adminNote;

    /** What the admin asked the applicant to provide or clarify (MORE_INFORMATION_REQUIRED). */
    @Column(name = "requested_info", length = 1000)
    private String requestedInfo;

    /** Admin user id who reviewed the request (null while PENDING). */
    @Column(name = "reviewed_by")
    private Long reviewedBy;

    /** When the admin reviewed the request (null while PENDING). */
    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
