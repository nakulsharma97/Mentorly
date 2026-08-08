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
 * An ordered module (milestone) inside a career path. Modules contain
 * {@link RoadmapLesson}s.
 */
@Getter
@Setter
@Entity
@Table(name = "roadmap_modules")
public class RoadmapModule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "career_path_id", nullable = false)
    private CareerPath careerPath;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(length = 500)
    private String description;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    @Column(name = "estimated_weeks", nullable = false)
    private Integer estimatedWeeks = 2;
}
