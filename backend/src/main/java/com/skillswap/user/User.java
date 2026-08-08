package com.skillswap.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.skillswap.messaging.MessagePrivacy;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Encapsulates user.
 */
@Getter
@Setter
@Entity
@Table(name = "users")
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true)
    private String username;

    /**
     * Lowercased copy of {@link #username} used to enforce case-insensitive
     * uniqueness at the database level (see V56 migration). Always kept in
     * sync automatically via {@link #syncUsernameLower()}.
     */
    @Column(name = "username_lower", nullable = false, unique = true, length = 255)
    private String usernameLower;

    /**
     * Keeps {@code username_lower} consistent with {@code username} on every
     * persist/update — whichever code path writes the display username (signup,
     * OAuth provisioning, username edit, admin tooling, tests) automatically
     * gets the normalized copy too.
     */
    @PrePersist
    @PreUpdate
    protected void syncUsernameLower() {
        if (this.username != null) {
            this.usernameLower = this.username.toLowerCase(java.util.Locale.ROOT);
        }
    }

    @JsonIgnore
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role = UserRole.LEARNER;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_sub_role", nullable = true)
    private AdminSubRole adminSubRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_privacy", nullable = false)
    private MessagePrivacy messagePrivacy = MessagePrivacy.ANYONE;

    @Column(nullable = false)
    private String fullName;

    private String walletAddress;

    @Column(name = "referral_code", nullable = false, unique = true)
    private String referralCode;

    @Column(name = "referred_by_user_id")
    private Long referredByUserId;

    @Column(columnDefinition = "TEXT")
    private String aboutMe;

    private String skills;

    private String githubUrl;

    private String linkedinUrl;

    private String profileImageUrl;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UserProject> projectsList = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String projects;

    @Column(columnDefinition = "TEXT")
    private String certificates;

    @Column(columnDefinition = "TEXT")
    private String pastTeachingSessions;

    @Column(columnDefinition = "TEXT")
    private String verifiedSkills;

    @Column(name = "company")
    private String company;

    @Column(name = "headline")
    private String headline;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    /**
     * Month remainder of total experience (0–11). Combined with
     * {@link #yearsOfExperience} so mentors can record precise durations such
     * as "1 year 6 months" or "3 months" (0 years). Null means "not provided"
     * or "whole years only".
     */
    @Column(name = "months_of_experience")
    private Integer monthsOfExperience;

    @Column(name = "languages")
    private String languages;

    @Column(name = "hourly_rate")
    private java.math.BigDecimal hourlyRate;

    @Column(name = "response_time_minutes")
    private Integer responseTimeMinutes;

    /** URL to the mentor's resume document, reviewed during mentor verification. */
    @Column(name = "resume_url", length = 1000)
    private String resumeUrl;

    @Column(nullable = false)
    private boolean mentorVerified = false;

    /**
     * User-level mentor verification state (NOT_SUBMITTED / PENDING /
     * UNDER_REVIEW / APPROVED / REJECTED / MORE_INFORMATION_REQUIRED /
     * SUSPENDED). Kept in sync by {@code MentorVerificationService} on every
     * submission and review decision. Only {@code APPROVED} mentors are visible
     * to learners and allowed to use marketplace features.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 32)
    private MentorVerificationStatus verificationStatus = MentorVerificationStatus.NOT_SUBMITTED;

    /** When the mentor was last approved (null unless currently/ever APPROVED). */
    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    /** Admin user id who approved the mentor. */
    @Column(name = "verified_by")
    private Long verifiedBy;

    /** When the latest verification application was submitted. */
    @Column(name = "verification_submitted_at")
    private OffsetDateTime verificationSubmittedAt;

    /** When an admin last reviewed (approved/rejected/suspended) the mentor. */
    @Column(name = "verification_reviewed_at")
    private OffsetDateTime verificationReviewedAt;

    /** Admin-supplied reason for a REJECTED or SUSPENDED decision. */
    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @JsonIgnore
    @Column(name = "password_reset_token")
    private String passwordResetToken;

    @JsonIgnore
    @Column(name = "password_reset_token_expiry")
    private OffsetDateTime passwordResetTokenExpiry;

    @Column(name = "last_active_at", nullable = false)
    private OffsetDateTime lastActiveAt = OffsetDateTime.now();

    /**
     * Whether the user has completed the mandatory onboarding flow. New
     * accounts default to {@code false} and must finish their profile before
     * accessing core features. Admins are exempt from the flow.
     */
    @Column(name = "profile_completed", nullable = false)
    private boolean profileCompleted = false;

    @Column(name = "country")
    private String country;

    @Column(name = "state")
    private String state;

    @Column(name = "city")
    private String city;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "timezone")
    private String timezone;

    @Column(columnDefinition = "TEXT")
    private String education;

    @Column(name = "portfolio_url", length = 1000)
    private String portfolioUrl;

    @Column(columnDefinition = "TEXT")
    private String availability;

    @Column(columnDefinition = "TEXT")
    private String learningGoals;

    @Column(name = "current_skill_level")
    private String currentSkillLevel;

    /**
     * Whether this user is a fully verified mentor who is allowed to appear in
     * learner-facing listings, publish availability, create sessions, receive
     * bookings, and accept learner messages.
     */
    public boolean isApprovedMentor() {
        return role == UserRole.MENTOR
                && verificationStatus == MentorVerificationStatus.APPROVED
                && profileCompleted;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    /**
     * {@inheritDoc} Returns the password hash for the Spring Security
     * UserDetails contract. Serialization is suppressed — the raw hash must
     * never appear in API responses.
     */
    @Override
    @JsonIgnore
    public String getPassword() {
        return passwordHash;
    }

    /**
     * Returns the email address as the Spring Security principal identifier.
     * This is the UserDetails contract — the authentication system uses email
     * as the unique identifier for login and JWT subject claims.
     */
    @Override
    public String getUsername() {
        return email;
    }

    /**
     * Returns the actual display username (the unique handle chosen by the user
     * during signup), NOT the email. Use this in all DTO conversions and
     * frontend-facing responses.
     */
    public String getDisplayUsername() {
        return this.username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
