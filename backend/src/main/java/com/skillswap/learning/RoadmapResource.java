package com.skillswap.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * An external learning resource (official docs, courses, articles, videos)
 * recommended for a career path. Resources always open in a new browser tab —
 * nothing is embedded inside SkillSwap.
 */
@Getter
@Setter
@Entity
@Table(name = "roadmap_resources")
public class RoadmapResource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "career_path_id", nullable = false)
    private CareerPath careerPath;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 700)
    private String url;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 32)
    private RoadmapResourceType resourceType = RoadmapResourceType.DOCUMENTATION;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;
}
