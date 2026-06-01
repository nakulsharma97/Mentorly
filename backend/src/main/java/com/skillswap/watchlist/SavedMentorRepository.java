package com.skillswap.watchlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedMentorRepository extends JpaRepository<SavedMentor, Long> {
    List<SavedMentor> findByLearnerId(Long learnerId);

    List<SavedMentor> findByMentorId(Long mentorId);

    Optional<SavedMentor> findByLearnerIdAndMentorId(Long learnerId, Long mentorId);
}
