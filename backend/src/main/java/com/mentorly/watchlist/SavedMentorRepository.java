package com.mentorly.watchlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing saved mentor bookmarks.
 */
public interface SavedMentorRepository
        extends JpaRepository<SavedMentor, Long> {

    /**
     * Returns all mentors saved by the given learner.
     *
     * @param learnerId the learner's ID
     * @return list of saved mentor entries
     */
    List<SavedMentor> findByLearnerId(Long learnerId);

    /**
     * Finds all learners who saved the given mentor.
     *
     * @param mentorId the mentor's ID
     * @return list of saved mentor entries
     */
    List<SavedMentor> findByMentorId(Long mentorId);

    /**
     * Finds a specific bookmark by learner and mentor.
     *
     * @param learnerId the learner's ID
     * @param mentorId  the mentor's ID
     * @return the bookmark if found
     */
    Optional<SavedMentor> findByLearnerIdAndMentorId(
            Long learnerId, Long mentorId);
}
