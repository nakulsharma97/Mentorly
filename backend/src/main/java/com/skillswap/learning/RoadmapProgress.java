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
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A completion record for one lesson on one learner roadmap. The unique
 * constraint (learner_roadmap_id, lesson_id) guarantees a lesson can only be
 * completed once per roadmap.
 */
@Getter
@Setter
@Entity
@Table(name = "roadmap_progress",
        uniqueConstraints = @UniqueConstraint(name = "uq_rpr",
                columnNames = {"learner_roadmap_id", "lesson_id"}))
public class RoadmapProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "learner_roadmap_id", nullable = false)
    private LearnerRoadmap learnerRoadmap;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lesson_id", nullable = false)
    private RoadmapLesson lesson;

    @Column(name = "completed_at", nullable = false)
    private OffsetDateTime completedAt = OffsetDateTime.now();
}
