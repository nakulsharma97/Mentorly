package com.skillswap.messaging;

import com.skillswap.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface DirectConversationRepository extends JpaRepository<DirectConversation, Long> {
    @Query("select c from DirectConversation c where " +
            "(c.participantOne = :user1 and c.participantTwo = :user2) or " +
            "(c.participantOne = :user2 and c.participantTwo = :user1)")
    Optional<DirectConversation> findBetweenUsers(@Param("user1") User user1, @Param("user2") User user2);
}
