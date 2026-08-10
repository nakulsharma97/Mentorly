package com.skillswap.watchlist;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    Page<SkillWatchlist> findByLearnerId(Long learnerId, Pageable pageable);

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

    /**
     * Counts how many learners currently track a skill (case-insensitive).
     *
     * @param skillName the skill name
     * @return number of matching watchlist entries
     */
    long countBySkillNameIgnoreCase(String skillName);

    /**
     * Deletes every watchlist entry referencing the given skill name
     * (case-insensitive). Used when a skill is removed from the catalog so
     * stale references do not linger in learner watchlists.
     *
     * @param skillName the skill name being removed
     * @return number of deleted rows
     */
    @Modifying
    @Query("delete from SkillWatchlist w where lower(w.skillName) = lower(:skillName)")
    long deleteBySkillNameIgnoreCase(@Param("skillName") String skillName);

    /**
     * Returns {@code [lower(skillName), count]} grouped by skill name so the
     * admin skill list can show watchlist popularity without N+1 queries.
     *
     * @return rows of {@code Object[]} with a String and a Number
     */
    @Query("select lower(w.skillName), count(w) from SkillWatchlist w group by lower(w.skillName)")
    List<Object[]> countGroupedBySkillName();

    /**
     * Re-points watchlist entries from {@code fromName} to {@code toName}
     * (case-insensitive) when two skills are merged. Rows that would collide
     * with an existing entry for the same learner and the target name are left
     * in place so the (learner, skillName) unique constraint is never violated.
     *
     * @param fromName the skill name being merged away
     * @param toName   the canonical skill name that survives
     * @return number of rows re-pointed
     */
    @Modifying
    @Query("update SkillWatchlist w set w.skillName = :toName "
            + "where lower(w.skillName) = lower(:fromName) "
            + "and not exists (select 1 from SkillWatchlist w2 "
            + "where w2.learner.id = w.learner.id and lower(w2.skillName) = lower(:toName))")
    int mergeSkillName(@Param("fromName") String fromName, @Param("toName") String toName);

    /**
     * Removes watchlist entries that reference the merged-away skill name and
     * are duplicates of the target skill for the same learner. Run after
     * {@link #mergeSkillName} to clean up rows that could not be re-pointed
     * because the learner already tracked the target skill.
     *
     * @param fromName the skill name being merged away
     * @param toName   the canonical skill name that survives
     * @return number of deleted rows
     */
    @Modifying
    @Query("delete from SkillWatchlist w where lower(w.skillName) = lower(:fromName) "
            + "and exists (select 1 from SkillWatchlist w2 "
            + "where w2.learner.id = w.learner.id and lower(w2.skillName) = lower(:toName))")
    int deleteDuplicateMergedSkillName(@Param("fromName") String fromName, @Param("toName") String toName);
}
