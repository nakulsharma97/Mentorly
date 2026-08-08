package com.skillswap.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link SessionNote}.
 */
public interface SessionNoteRepository extends JpaRepository<SessionNote, Long> {

    Optional<SessionNote> findByBookingIdAndLearnerId(Long bookingId, Long learnerId);

    List<SessionNote> findTop5ByLearnerIdOrderByUpdatedAtDesc(Long learnerId);

    List<SessionNote> findByLearnerIdAndBookingIdIn(Long learnerId, Collection<Long> bookingIds);

    long countByLearnerId(Long learnerId);
}
