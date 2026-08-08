package com.skillswap.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A curated career path from the learning catalog (e.g. "Java Backend
 * Developer"). The catalog is fully database-driven — the platform never
 * generates roadmaps or guesses what a learner wants to study.
 */
@Getter
@Setter
@Entity
@Table(name = "career_paths")
public class CareerPath {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 120)
    private String slug;

    @Column(nullable = false, length = 600)
    private String description;

    @Column(name = "duration_weeks", nullable = false)
    private Integer durationWeeks;

    @Column(nullable = false, length = 32)
    private String difficulty;

    /** Comma-separated skills covered by this path. */
    @Column(nullable = false, length = 1000)
    private String skills;

    /** Material Symbols icon name used by the UI. */
    @Column(nullable = false, length = 64)
    private String icon = "school";

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
