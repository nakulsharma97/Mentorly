package com.skillswap.mentorcertification;

import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "mentor_certifications")
public class MentorCertification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "mentor_id", nullable = false)
    private User mentor;

    @Column(name = "certification_name", nullable = false, length = 500)
    private String certificationName;

    @Column(name = "issuing_organization", nullable = false, length = 500)
    private String issuingOrganization;

    @Column(name = "credential_id", length = 500)
    private String credentialId;

    @Column(name = "credential_url", length = 1000)
    private String credentialUrl;

    @Column(name = "issue_date", nullable = false)
    private LocalDate issueDate;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Column(name = "does_not_expire", nullable = false)
    private boolean doesNotExpire = false;

    @Column(name = "skills_covered", columnDefinition = "TEXT")
    private String skillsCovered;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "certificate_image", length = 1000)
    private String certificateImage;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
