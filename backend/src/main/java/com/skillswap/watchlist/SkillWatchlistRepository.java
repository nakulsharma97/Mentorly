package com.skillswap.watchlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SkillWatchlistRepository extends JpaRepository<SkillWatchlist, Long> {
    List<SkillWatchlist> findByLearnerId(Long learnerId);

    List<SkillWatchlist> findBySkillNameIgnoreCase(String skillName);

    List<SkillWatchlist> findBySkillNameContainingIgnoreCase(String skillName);

    Optional<SkillWatchlist> findByLearnerIdAndSkillNameIgnoreCase(Long learnerId, String skillName);
}
