package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link LearnerTask}. Every query is scoped to the
 * learner so one learner can never read or modify another's tasks.
 */
public interface LearnerTaskRepository extends JpaRepository<LearnerTask, Long> {

    List<LearnerTask> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    Optional<LearnerTask> findByIdAndLearnerId(Long id, Long learnerId);
}
