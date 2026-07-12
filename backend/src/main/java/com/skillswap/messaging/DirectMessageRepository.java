package com.skillswap.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
    List<DirectMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    Optional<DirectMessage> findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);

    @Modifying
    @Query("""
            update DirectMessage m
            set m.readByRecipient = true
            where m.conversation.id = :conversationId
                and m.sender.email <> :readerEmail
                and m.readByRecipient = false
            """)
    int markAllAsReadByConversationId(@Param("conversationId") Long conversationId, @Param("readerEmail") String readerEmail);
}
