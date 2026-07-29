package com.skillswap.watchlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing skill watchlist entries.
 */
public interface SkillWatchlistRepository
        extends JpaRepository<SkillWatchlist, Long> {

    /**
     * Returns all skills tracked by the given learner.
     *
     * @param learnerId the learner's ID
     * @return list of watched skills
     */
    List<SkillWatchlist> findByLearnerId(Long learnerId);

    /**
     * Finds skills by exact name (case-insensitive).
     *
     * @param skillName the skill name to search for
     * @return list of matching watchlist entries
     */
    List<SkillWatchlist> findBySkillNameIgnoreCase(String skillName);

    /**
     * Finds skills whose name contains the given text (case-insensitive).
     *
     * @param skillName partial skill name to search for
     * @return list of matching watchlist entries
     */
    List<SkillWatchlist> findBySkillNameContainingIgnoreCase(
            String skillName);

    /**
     * Finds a specific skill tracked by a specific learner (case-insensitive).
     *
     * @param learnerId the learner's ID
     * @param skillName the skill name
     * @return the matching watchlist entry if found
     */
    Optional<SkillWatchlist> findByLearnerIdAndSkillNameIgnoreCase(
            Long learnerId, String skillName);
}
