package com.skillswap.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
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
 * A certificate issued when a learner completes a roadmap milestone (a module)
 * or the entire roadmap. Certificates are only ever created by completing real
 * milestones — they are never shown or granted otherwise.
 */
@Getter
@Setter
@Entity
@Table(name = "roadmap_certificates")
public class RoadmapCertificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "learner_roadmap_id", nullable = false)
    private LearnerRoadmap learnerRoadmap;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(name = "issued_at", nullable = false)
    private OffsetDateTime issuedAt = OffsetDateTime.now();
}
