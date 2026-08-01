package com.skillswap.moderation;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModerationEventRepository extends JpaRepository<ModerationEvent, Long> {

    /**
     * Timeline events with their {@code actor} initialized — the actor is LAZY
     * and the controller maps events outside the repository transaction
     * ({@code open-in-view: false}).
     */
    @EntityGraph(attributePaths = {"actor"})
    List<ModerationEvent> findByFlaggedContentIdOrderByCreatedAtAsc(Long flaggedContentId);
}
