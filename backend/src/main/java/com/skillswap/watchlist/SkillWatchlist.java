package com.skillswap.watchlist;

import com.skillswap.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Entity representing a skill that a learner is tracking in their watchlist.
 */
/**
 * Encapsulates skill watchlist.
 */
@Getter
@Setter
@Entity
@Table(name = "skill_watchlist")
public class SkillWatchlist {

    /** Unique identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The learner who added this skill to their watchlist. */
    @ManyToOne(optional = false)
    @JoinColumn(name = "learner_id")
    private User learner;

    /** The name of the skill being tracked. */
    @Column(name = "skill_name", nullable = false)
    private String skillName;

    /** When this watchlist entry was created. */
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
