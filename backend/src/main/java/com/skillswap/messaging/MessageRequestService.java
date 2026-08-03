package com.skillswap.messaging;

import com.skillswap.booking.BookingRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Service implementing message request business logic.
 */
@Service
@RequiredArgsConstructor
public class MessageRequestService {

    private final MessageRequestRepository messageRequestRepository;
    private final DirectConversationRepository directConversationRepository;
    private final DirectMessageRepository directMessageRepository;
    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @Transactional
    public MessageRequest createRequest(User sender, Long receiverId, String firstMessage) {
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new IllegalArgumentException("Receiver not found"));
        return createRequest(sender, receiver, firstMessage);
    }

    @Transactional
    public MessageRequest createRequest(User sender, User receiver, String firstMessage) {
        if (sender == null || receiver == null) {
            throw new IllegalArgumentException("Both users are required");
        }
        if (sender.getId().equals(receiver.getId())) {
            throw new IllegalArgumentException("You cannot message yourself");
        }
        if (firstMessage == null || firstMessage.isBlank()) {
            throw new IllegalArgumentException("Your first message is required");
        }

        enforcePrivacy(sender, receiver);

        MessageRequest existing = messageRequestRepository
                .findTopBySenderIdAndReceiverIdOrderByCreatedAtDesc(sender.getId(), receiver.getId());
        if (existing != null && existing.getStatus() == MessageRequestStatus.PENDING) {
            throw new IllegalArgumentException("You already have a pending request with this user already pending");
        }
        if (existing != null && existing.getStatus() == MessageRequestStatus.DECLINED && existing.getCreatedAt() != null
                && existing.getCreatedAt().plusHours(24).isAfter(OffsetDateTime.now())) {
            throw new IllegalArgumentException("Please wait 24 hours before sending another request to this user");
        }

        if (directConversationRepository.findBetweenUsers(sender, receiver).isPresent()) {
            throw new IllegalArgumentException("A conversation already exists between these users");
        }

        MessageRequest request = new MessageRequest();
        request.setSender(sender);
        request.setReceiver(receiver);
        request.setFirstMessage(firstMessage.trim());
        request.setStatus(MessageRequestStatus.PENDING);
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());
        MessageRequest saved = messageRequestRepository.save(request);

        notificationService.notifyUser(receiver.getId(), "MESSAGE_REQUEST_RECEIVED", "New message request",
                sender.getFullName() + " wants to connect", saved.getId());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<MessageRequest> listPendingRequests(User currentUser) {
        return messageRequestRepository.findByReceiverIdAndStatusOrderByCreatedAtDesc(currentUser.getId(),
                MessageRequestStatus.PENDING);
    }

    @Transactional
    public MessageRequest acceptRequest(User currentUser, Long requestId) {
        MessageRequest request = messageRequestRepository.findByIdAndReceiverId(requestId, currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (request.getStatus() != MessageRequestStatus.PENDING) {
            throw new IllegalArgumentException("Request is no longer pending");
        }

        request.setStatus(MessageRequestStatus.ACCEPTED);
        request.setUpdatedAt(OffsetDateTime.now());
        MessageRequest saved = messageRequestRepository.save(request);

        DirectConversation conversation = new DirectConversation();
        conversation.setParticipantOne(request.getSender());
        conversation.setParticipantTwo(request.getReceiver());
        conversation.setCreatedAt(OffsetDateTime.now());
        conversation.setUpdatedAt(OffsetDateTime.now());
        DirectConversation persistedConversation = directConversationRepository.save(conversation);

        DirectMessage directMessage = new DirectMessage();
        directMessage.setConversation(persistedConversation);
        directMessage.setSender(request.getSender());
        directMessage.setContent(request.getFirstMessage());
        directMessage.setCreatedAt(OffsetDateTime.now());
        directMessageRepository.save(directMessage);

        notificationService.notifyUser(request.getSender().getId(), "MESSAGE_REQUEST_ACCEPTED", "Request accepted",
                currentUser.getFullName() + " accepted your message request", saved.getId());
        return saved;
    }

    @Transactional
    public MessageRequest declineRequest(User currentUser, Long requestId) {
        MessageRequest request = messageRequestRepository.findByIdAndReceiverId(requestId, currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (request.getStatus() != MessageRequestStatus.PENDING) {
            throw new IllegalArgumentException("Request is no longer pending");
        }

        request.setStatus(MessageRequestStatus.DECLINED);
        request.setUpdatedAt(OffsetDateTime.now());
        MessageRequest saved = messageRequestRepository.save(request);
        notificationService.notifyUser(request.getSender().getId(), "MESSAGE_REQUEST_DECLINED", "Request declined",
                currentUser.getFullName() + " declined your message request", saved.getId());
        return saved;
    }

    private void enforcePrivacy(User sender, User receiver) {
        MessagePrivacy privacy = receiver.getMessagePrivacy() == null ? MessagePrivacy.ANYONE
                : receiver.getMessagePrivacy();
        if (privacy == MessagePrivacy.NOBODY) {
            throw new IllegalArgumentException("This user is not accepting new message requests.");
        }
        if (privacy == MessagePrivacy.MENTORS_ONLY && sender.getRole() != UserRole.MENTOR) {
            throw new IllegalArgumentException("This user only accepts message requests from mentors.");
        }
        if (privacy == MessagePrivacy.LEARNERS_ONLY && sender.getRole() != UserRole.LEARNER) {
            throw new IllegalArgumentException("This user only accepts message requests from learners.");
        }
        if (privacy == MessagePrivacy.CONNECTED_ONLY) {
            boolean connected = hasAcceptedConversation(sender, receiver) || hasAcceptedSession(sender, receiver);
            if (!connected) {
                throw new IllegalArgumentException("This user only accepts message requests from connected users.");
            }
        }
    }

    private boolean hasAcceptedConversation(User sender, User receiver) {
        return directConversationRepository.findBetweenUsers(sender, receiver).isPresent();
    }

    private boolean hasAcceptedSession(User sender, User receiver) {
        return bookingRepository
                .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(sender.getId(), receiver.getId(),
                        com.skillswap.booking.BookingStatus.ACCEPTED)
                .stream().findAny().isPresent()
                || bookingRepository
                        .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(receiver.getId(),
                                sender.getId(), com.skillswap.booking.BookingStatus.ACCEPTED)
                        .stream().findAny().isPresent();
    }

}
