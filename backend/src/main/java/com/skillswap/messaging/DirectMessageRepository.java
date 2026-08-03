package com.skillswap.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code DirectMessage} persistence.
 */
public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
    List<DirectMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    Optional<DirectMessage> findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);

    /**
     * Batch-fetch the last message for each direct conversation in a single query.
     * Uses a subquery to find the max (latest) message id per conversation.
     *
     * @param conversationIds list of conversation IDs to fetch last messages for
     * @return list of last messages per conversation (one per conversation)
     */
    @Query("""
            SELECT m FROM DirectMessage m
            WHERE m.id IN (
                SELECT MAX(m2.id) FROM DirectMessage m2
                WHERE m2.conversation.id IN :conversationIds
                GROUP BY m2.conversation.id
            )
            """)
    List<DirectMessage> findLastMessagesByConversationIds(@Param("conversationIds") List<Long> conversationIds);

    /**
     * Batch-count unread messages (not yet read by the recipient) per direct
     * conversation, in a single query. Returns rows of [conversationId, unreadCount].
     */
    @Query("""
            SELECT m.conversation.id, COUNT(m) FROM DirectMessage m
            WHERE m.conversation.id IN :conversationIds AND m.readByRecipient = false
            GROUP BY m.conversation.id
            """)
    List<Object[]> countUnreadByConversationIds(@Param("conversationIds") List<Long> conversationIds);

    long countByConversationIdAndSenderEmailNotAndReadByRecipientFalse(Long conversationId, String senderEmail);

    @Modifying
    @Query("""
            update DirectMessage m
            set m.readByRecipient = true
            where m.conversation.id = :conversationId
                and m.sender.email <> :readerEmail
                and m.readByRecipient = false
            """)
    int markAllAsReadByConversationId(@Param("conversationId") Long conversationId,
            @Param("readerEmail") String readerEmail);
}
