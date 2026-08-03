package com.skillswap.messaging;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code MessageRequest} persistence.
 */
public interface MessageRequestRepository extends JpaRepository<MessageRequest, Long> {
    List<MessageRequest> findByReceiverIdAndStatusOrderByCreatedAtDesc(Long receiverId, MessageRequestStatus status);

    Optional<MessageRequest> findByIdAndReceiverId(Long id, Long receiverId);

    MessageRequest findTopBySenderIdAndReceiverIdOrderByCreatedAtDesc(Long senderId, Long receiverId);
}
