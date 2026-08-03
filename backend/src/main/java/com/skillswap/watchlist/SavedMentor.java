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
 * Entity representing a mentor saved (bookmarked) by a learner.
 */
/**
 * Encapsulates saved mentor.
 */
@Getter
@Setter
@Entity
@Table(name = "saved_mentors")
public class SavedMentor {

    /** Unique identifier. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The learner who saved this mentor. */
    @ManyToOne(optional = false)
    @JoinColumn(name = "learner_id")
    private User learner;

    /** The mentor being saved. */
    @ManyToOne(optional = false)
    @JoinColumn(name = "mentor_id")
    private User mentor;

    /** When this bookmark was created. */
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
