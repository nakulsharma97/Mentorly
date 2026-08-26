package com.mentorly.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link LearnerTodo}. Every query is scoped to the
 * learner so one learner can never read or modify another's todos.
 */
public interface LearnerTodoRepository extends JpaRepository<LearnerTodo, Long> {

    List<LearnerTodo> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    Optional<LearnerTodo> findByIdAndLearnerId(Long id, Long learnerId);
}
