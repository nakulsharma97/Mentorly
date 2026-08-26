package com.mentorly.messaging;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code MessageRequest} persistence.
 */
public interface MessageRequestRepository extends JpaRepository<MessageRequest, Long> {
    List<MessageRequest> findByReceiverIdAndStatusOrderByCreatedAtDesc(Long receiverId, MessageRequestStatus status);

    /**
     * Pessimistic write lock so concurrent accept/decline on the same request
     * can never both pass the PENDING check and double-create a conversation
     * or double-insert the first message.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<MessageRequest> findByIdAndReceiverId(Long id, Long receiverId);

    MessageRequest findTopBySenderIdAndReceiverIdOrderByCreatedAtDesc(Long senderId, Long receiverId);
}
