package com.mentorly.messaging;

import com.mentorly.user.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code DirectConversation} persistence.
 */
public interface DirectConversationRepository extends JpaRepository<DirectConversation, Long> {
    @Query("select c from DirectConversation c where "
            + "(c.participantOne = :user1 and c.participantTwo = :user2) or "
            + "(c.participantOne = :user2 and c.participantTwo = :user1)")
    Optional<DirectConversation> findBetweenUsers(@Param("user1") User user1, @Param("user2") User user2);

    List<DirectConversation> findByParticipantOneOrderByUpdatedAtDesc(User participantOne);

    List<DirectConversation> findByParticipantTwoOrderByUpdatedAtDesc(User participantTwo);

    /**
     * Fetches direct conversations with both participants eagerly loaded.
     * Participants are {@code FetchType.LAZY} on the entity, so a plain
     * {@code findAll} would trigger a LazyInitializationException outside a
     * transaction (the app runs with {@code open-in-view: false}). The
     * {@code @EntityGraph} fetches them in the same query as the list.
     */
    @EntityGraph(attributePaths = {"participantOne", "participantTwo"})
    @Query("select c from DirectConversation c")
    List<DirectConversation> findAllWithParticipants(Pageable pageable);
}
