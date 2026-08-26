package com.mentorly.messaging;

import com.mentorly.booking.BookingRepository;
import com.mentorly.notification.NotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger LOG = LoggerFactory.getLogger(MessageRequestService.class);

    private final MessageRequestRepository messageRequestRepository;
    private final DirectConversationRepository directConversationRepository;
    private final DirectMessageRepository directMessageRepository;
    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @Transactional
    public MessageRequestView createRequest(User sender, Long receiverId, String firstMessage) {
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new IllegalArgumentException("Receiver not found"));
        return createRequest(sender, receiver, firstMessage);
    }

    @Transactional
    public MessageRequestView createRequest(User sender, User receiver, String firstMessage) {
        LOG.info("[Conversation Request] Sender ID: {}, Receiver ID: {}, firstMessage present: {}",
                sender == null ? null : sender.getId(),
                receiver == null ? null : receiver.getId(),
                firstMessage != null && !firstMessage.isBlank());
        if (sender == null || receiver == null) {
            throw new IllegalArgumentException("Both users are required");
        }
        if (sender.getId().equals(receiver.getId())) {
            throw new IllegalArgumentException("You cannot message yourself");
        }
        // Conversation requests are a learner/mentor marketplace feature — the
        // receiver must be the SELECTED learner or mentor, never an admin
        // (defense in depth: search already excludes admins, but a direct API
        // call must not be able to target one either).
        if (receiver.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Message requests can only be sent to learners or mentors");
        }
        if (sender.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admins cannot send conversation requests");
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

        LOG.info("[Conversation Request] Validation passed. Saving conversation request (sender={}, receiver={})...",
                sender.getId(), receiver.getId());
        MessageRequest request = new MessageRequest();
        request.setSender(sender);
        request.setReceiver(receiver);
        request.setFirstMessage(firstMessage.trim());
        request.setStatus(MessageRequestStatus.PENDING);
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());
        MessageRequest saved = messageRequestRepository.save(request);
        LOG.info("[Conversation Request] Saved successfully. Request ID: {}, status: PENDING",
                saved.getId());

        notificationService.notifyUser(receiver.getId(), "MESSAGE_REQUEST_RECEIVED", "New Conversation Request",
                sender.getFullName() + " wants to start a conversation with you.", saved.getId());
        LOG.info("[Conversation Request] Notification delivered to receiver {}. Response ready.",
                receiver.getId());
        return MessageRequestView.from(saved);
    }

    @Transactional(readOnly = true)
    public List<MessageRequestView> listPendingRequests(User currentUser) {
        List<MessageRequest> requests = messageRequestRepository
                .findByReceiverIdAndStatusOrderByCreatedAtDesc(currentUser.getId(),
                        MessageRequestStatus.PENDING);
        LOG.info("[Conversation Request] Pending requests fetched for user {}: {}",
                currentUser.getId(), requests.size());
        return requests.stream().map(MessageRequestView::from).toList();
    }

    @Transactional
    public MessageRequestView acceptRequest(User currentUser, Long requestId) {
        MessageRequest request = messageRequestRepository.findByIdAndReceiverId(requestId, currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (request.getStatus() != MessageRequestStatus.PENDING) {
            throw new IllegalArgumentException("Request is no longer pending");
        }

        request.setStatus(MessageRequestStatus.ACCEPTED);
        request.setUpdatedAt(OffsetDateTime.now());
        MessageRequest saved = messageRequestRepository.save(request);

        // Never create a duplicate conversation if one already exists between
        // the two users (e.g. they also have an accepted booking chat).
        DirectConversation conversation = directConversationRepository
                .findBetweenUsers(request.getSender(), request.getReceiver())
                .orElseGet(() -> {
                    DirectConversation created = new DirectConversation();
                    created.setParticipantOne(request.getSender());
                    created.setParticipantTwo(request.getReceiver());
                    created.setCreatedAt(OffsetDateTime.now());
                    created.setUpdatedAt(OffsetDateTime.now());
                    return directConversationRepository.save(created);
                });

        DirectMessage directMessage = new DirectMessage();
        directMessage.setConversation(conversation);
        directMessage.setSender(request.getSender());
        directMessage.setContent(request.getFirstMessage());
        directMessage.setCreatedAt(OffsetDateTime.now());
        directMessageRepository.save(directMessage);

        LOG.info("[Conversation Request] Request {} accepted by user {}. Conversation {} ready.",
                requestId, currentUser.getId(), conversation.getId());
        notificationService.notifyUser(request.getSender().getId(), "MESSAGE_REQUEST_ACCEPTED", "Request accepted",
                currentUser.getFullName() + " accepted your message request", saved.getId());
        return MessageRequestView.from(saved);
    }

    @Transactional
    public MessageRequestView declineRequest(User currentUser, Long requestId) {
        MessageRequest request = messageRequestRepository.findByIdAndReceiverId(requestId, currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (request.getStatus() != MessageRequestStatus.PENDING) {
            throw new IllegalArgumentException("Request is no longer pending");
        }

        request.setStatus(MessageRequestStatus.DECLINED);
        request.setUpdatedAt(OffsetDateTime.now());
        MessageRequest saved = messageRequestRepository.save(request);
        LOG.info("[Conversation Request] Request {} declined by user {}.", requestId, currentUser.getId());
        notificationService.notifyUser(request.getSender().getId(), "MESSAGE_REQUEST_DECLINED", "Request declined",
                currentUser.getFullName() + " declined your message request", saved.getId());
        return MessageRequestView.from(saved);
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
                        com.mentorly.booking.BookingStatus.ACCEPTED)
                .stream().findAny().isPresent()
                || bookingRepository
                        .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(receiver.getId(),
                                sender.getId(), com.mentorly.booking.BookingStatus.ACCEPTED)
                        .stream().findAny().isPresent();
    }

}
