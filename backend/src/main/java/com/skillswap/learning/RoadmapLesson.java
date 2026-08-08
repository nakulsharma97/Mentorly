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

/**
 * An ordered lesson inside a {@link RoadmapModule}. Learners mark lessons as
 * completed; completion is stored in {@link RoadmapProgress}.
 */
@Getter
@Setter
@Entity
@Table(name = "roadmap_lessons")
public class RoadmapLesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "module_id", nullable = false)
    private RoadmapModule module;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(length = 600)
    private String description;

    /** Practical exercise attached to the lesson. */
    @Column(length = 600)
    private String assignment;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes = 30;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;
}
