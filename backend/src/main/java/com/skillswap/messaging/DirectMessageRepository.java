package com.skillswap.messaging;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
    List<DirectMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
}
