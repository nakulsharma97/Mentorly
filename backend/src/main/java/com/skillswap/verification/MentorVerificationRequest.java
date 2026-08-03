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

    @Column(name = "document_url", nullable = false)
    private String documentUrl;

    @Column(name = "document_type")
    private String documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MentorVerificationRequestStatus status = MentorVerificationRequestStatus.PENDING;

    @Column(name = "admin_note")
    private String adminNote;

    /** Admin user id who reviewed the request (null while PENDING). */
    @Column(name = "reviewed_by")
    private Long reviewedBy;

    /** When the admin reviewed the request (null while PENDING). */
    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
