package com.skillswap.skill;

import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A user-submitted request to add a new skill category to the catalog.
 * Admins approve or reject these requests via the admin skill endpoints.
 */
@Getter
@Setter
@Entity
@Table(name = "skill_requests")
public class SkillRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SkillRequestStatus status = SkillRequestStatus.PENDING;

    @ManyToOne(optional = false)
    @JoinColumn(name = "requested_by")
    private User requestedBy;

    @Column(name = "admin_note")
    private String adminNote;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
