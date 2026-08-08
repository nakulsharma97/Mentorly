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
 * A portfolio project a learner should build while following a career path.
 * Projects belong to the career path (not the roadmap instance), so every
 * roadmap of the same path shares the same project list.
 */
@Getter
@Setter
@Entity
@Table(name = "roadmap_projects")
public class RoadmapProject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "career_path_id", nullable = false)
    private CareerPath careerPath;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(length = 600)
    private String description;

    @Column(nullable = false, length = 32)
    private String difficulty = "Intermediate";

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;
}
