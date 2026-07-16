package com.skillswap.chat;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.messaging.DirectMessage;
import com.skillswap.messaging.DirectMessageRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.safety.UserBlockRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final UserBlockRepository userBlockRepository;
    private final NotificationService notificationService;
    private final DirectConversationRepository directConversationRepository;
    private final DirectMessageRepository directMessageRepository;

    public List<ConversationDto> listConversations(User currentUser, String query, String filter) {
        List<Booking> bookings = loadBookingsForUser(currentUser);
        return bookings.stream()
                .map(booking -> toConversation(currentUser, booking))
                .filter(conversation -> filterConversation(conversation, query, filter))
                .sorted((a, b) -> b.lastMessageAt().compareTo(a.lastMessageAt()))
                .collect(Collectors.toList());
    }

    public List<ConversationDto> searchConversations(User currentUser, String query, String filter) {
        return listConversations(currentUser, query, filter);
    }

    public List<ChatMessageView> listMessages(User currentUser, Long bookingId, OffsetDateTime before, int limit) {
        Booking booking = getBookingIfParticipant(currentUser, bookingId);
        Pageable page = PageRequest.of(0, Math.min(limit, 100));
        List<ChatMessage> messages;
        if (before == null) {
            messages = chatMessageRepository.findByBookingIdOrderByCreatedAtDesc(booking.getId(), page);
        } else {
            messages = chatMessageRepository.findByBookingIdAndCreatedAtBeforeOrderByCreatedAtDesc(
                    booking.getId(), before, page);
        }
        Collections.reverse(messages);
        return messages.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatMessageView createMessage(User currentUser, Long bookingId, String content) {
        Booking booking = getBookingIfParticipant(currentUser, bookingId);
        return toDto(saveMessage(currentUser, booking, content));
    }

    @Transactional
    public ChatMessageView createMessage(String userEmail, Long bookingId, String content) {
        User sender = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Booking booking = getBookingIfParticipant(sender, bookingId);
        return toDto(saveMessage(sender, booking, content));
    }

    @Transactional(readOnly = true)
    public void ensureParticipant(String userEmail, Long bookingId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        getBookingIfParticipant(user, bookingId);
    }

    @Transactional
    public void markAllAsRead(Long bookingId, String readerEmail) {
        User reader = userRepository.findByEmail(readerEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        getBookingIfParticipant(reader, bookingId);
        chatMessageRepository.markAllAsReadByBookingId(bookingId, readerEmail);
    }

    private List<Booking> loadBookingsForUser(User currentUser) {
        if (currentUser.getRole() == null) {
            return List.of();
        }
        return switch (currentUser.getRole()) {
            case MENTOR -> bookingRepository.findBySessionMentorId(currentUser.getId());
            case LEARNER -> bookingRepository.findByLearnerIdOrderByCreatedAtDesc(currentUser.getId());
            default -> List.of();
        };
    }

    private boolean filterConversation(ConversationDto conversation, String query, String filter) {
        if (filter != null && !filter.isBlank()) {
            String normalized = filter.trim().toLowerCase(Locale.ROOT);
            switch (normalized) {
                case "unread":
                    if (conversation.unreadCount() == 0) {
                        return false;
                    }
                    break;
                case "mentors":
                    if (!"MENTOR".equalsIgnoreCase(conversation.participantRole())) {
                        return false;
                    }
                    break;
                case "learners":
                    if (!"LEARNER".equalsIgnoreCase(conversation.participantRole())) {
                        return false;
                    }
                    break;
                default:
                    break;
            }
        }

        if (query == null || query.isBlank()) {
            return true;
        }

        String normalized = query.trim().toLowerCase(Locale.ROOT);
        return conversation.participantName().toLowerCase(Locale.ROOT).contains(normalized)
                || conversation.participantRole().toLowerCase(Locale.ROOT).contains(normalized)
                || conversation.participantSkills().toLowerCase(Locale.ROOT).contains(normalized)
                || conversation.sessionTitle().toLowerCase(Locale.ROOT).contains(normalized)
                || conversation.lastMessagePreview().toLowerCase(Locale.ROOT).contains(normalized);
    }

    private ChatMessage saveMessage(User sender, Booking booking, String content) {
        String normalized = content == null ? "" : content.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Message cannot be empty");
        }

        ChatMessage message = new ChatMessage();
        message.setBooking(booking);
        message.setSender(sender);
        message.setContent(normalized);
        ChatMessage saved = chatMessageRepository.save(message);

        Long learnerId = booking.getLearner().getId();
        Long mentorId = booking.getSession().getMentor().getId();
        Long receiverId = sender.getId().equals(learnerId) ? mentorId : learnerId;
        notificationService.notifyUser(
                receiverId,
                "CHAT_MESSAGE",
                "New message",
                sender.getFullName() + " sent a new message on booking #" + booking.getId(),
                booking.getId());

        return saved;
    }

    private Booking getBookingIfParticipant(User user, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        boolean isLearner = booking.getLearner().getId().equals(user.getId());
        boolean isMentor = booking.getSession().getMentor().getId().equals(user.getId());
        if (!isLearner && !isMentor) {
            throw new IllegalArgumentException("Access denied for this booking chat");
        }

        Long learnerId = booking.getLearner().getId();
        Long mentorId = booking.getSession().getMentor().getId();
        boolean blocked = userBlockRepository.existsByBlockerIdAndBlockedId(learnerId, mentorId)
                || userBlockRepository.existsByBlockerIdAndBlockedId(mentorId, learnerId);
        if (blocked) {
            throw new IllegalArgumentException("Chat is disabled because one user has blocked the other");
        }

        return booking;
    }

    private ConversationDto toConversation(User currentUser, Booking booking) {
        User participant = getConversationParticipant(currentUser, booking);
        ChatMessage lastMessage = chatMessageRepository.findTopByBookingIdOrderByCreatedAtDesc(booking.getId());
        int unreadCount = (int) chatMessageRepository
                .countByBookingIdAndSenderEmailNotAndReadByRecipientFalse(booking.getId(), currentUser.getEmail());

        String lastPreview = lastMessage == null ? "No messages yet" : lastMessage.getContent();
        OffsetDateTime lastAt = lastMessage == null ? booking.getCreatedAt() : lastMessage.getCreatedAt();
        boolean online = participant.getLastActiveAt() != null && participant.getLastActiveAt()
                .isAfter(OffsetDateTime.now().minusMinutes(5));

        return new ConversationDto(
                booking.getId(),
                booking.getSession().getTitle(),
                participant.getId(),
                participant.getFullName(),
                participant.getRole().name(),
                participant.getSkills() == null ? "" : participant.getSkills(),
                participant.getProfileImageUrl(),
                participant.isMentorVerified(),
                online,
                computePresenceText(participant),
                lastPreview,
                lastAt,
                unreadCount);
    }

    private User getConversationParticipant(User currentUser, Booking booking) {
        if (booking.getLearner().getId().equals(currentUser.getId())) {
            return booking.getSession().getMentor();
        }
        return booking.getLearner();
    }

    private String computePresenceText(User user) {
        if (user.getLastActiveAt() == null) {
            return "Offline";
        }
        OffsetDateTime now = OffsetDateTime.now();
        Duration age = Duration.between(user.getLastActiveAt(), now);
        if (!user.getLastActiveAt().isBefore(now.minusMinutes(5))) {
            return "Online";
        }
        long minutes = age.toMinutes();
        if (minutes < 60) {
            return "Last seen " + minutes + " min ago";
        }
        long hours = age.toHours();
        return "Last seen " + hours + " hr ago";
    }

    private ChatMessageView toDto(ChatMessage message) {
        return new ChatMessageView(
                message.getId(),
                message.getBooking().getId(),
                message.getSender().getId(),
                message.getSender().getEmail(),
                message.getSender().getFullName(),
                message.getSender().getRole().name(),
                message.getSender().getProfileImageUrl(),
                message.getSender().isMentorVerified(),
                message.getContent(),
                message.isReadByRecipient(),
                message.getCreatedAt() == null ? OffsetDateTime.now() : message.getCreatedAt());
    }

    @Transactional
    public DirectConversationResponse createOrGetDirectConversation(User currentUser, Long targetUserId) {
        if (currentUser.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("You cannot message yourself");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean blocked = userBlockRepository.existsByBlockerIdAndBlockedId(currentUser.getId(), targetUserId)
                || userBlockRepository.existsByBlockerIdAndBlockedId(targetUserId, currentUser.getId());
        if (blocked) {
            throw new IllegalArgumentException("Cannot start a conversation with this user");
        }

        // Check if direct conversation already exists
        Optional<DirectConversation> existing = directConversationRepository.findBetweenUsers(currentUser, target);
        if (existing.isPresent()) {
            DirectConversation dc = existing.get();
            int unreadCount = (int) directMessageRepository
                    .countByConversationIdAndSenderEmailNotAndReadByRecipientFalse(dc.getId(), currentUser.getEmail());
            return new DirectConversationResponse(
                    dc.getId(),
                    target.getId(),
                    target.getFullName(),
                    target.getRole().name(),
                    target.getSkills() == null ? "" : target.getSkills(),
                    target.getProfileImageUrl(),
                    target.isMentorVerified(),
                    isUserOnline(target),
                    computePresenceText(target),
                    "",
                    dc.getCreatedAt(),
                    unreadCount);
        }

        // Create new direct conversation
        DirectConversation conversation = new DirectConversation();
        conversation.setParticipantOne(currentUser);
        conversation.setParticipantTwo(target);
        conversation.setCreatedAt(OffsetDateTime.now());
        conversation.setUpdatedAt(OffsetDateTime.now());
        DirectConversation saved = directConversationRepository.save(conversation);

        // Notify the target user
        notificationService.notifyUser(
                targetUserId,
                "CHAT_MESSAGE",
                "New conversation",
                currentUser.getFullName() + " started a conversation with you",
                saved.getId());

        return new DirectConversationResponse(
                saved.getId(),
                target.getId(),
                target.getFullName(),
                target.getRole().name(),
                target.getSkills() == null ? "" : target.getSkills(),
                target.getProfileImageUrl(),
                target.isMentorVerified(),
                false,
                "Offline",
                "",
                saved.getCreatedAt(),
                0);
    }

    public List<DirectMessageView> listDirectMessages(User currentUser, Long conversationId) {
        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));

        boolean isParticipant = conversation.getParticipantOne().getId().equals(currentUser.getId())
                || conversation.getParticipantTwo().getId().equals(currentUser.getId());
        if (!isParticipant) {
            throw new IllegalArgumentException("Access denied");
        }

        return directMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(this::toDirectMessageView)
                .collect(Collectors.toList());
    }

    /**
     * Lightweight check — validates the user is a participant in a direct conversation
     * without fetching any messages. Throws on failure, returns true on success.
     */
    @Transactional(readOnly = true)
    public boolean isParticipantInConversation(String userEmail, Long conversationId) {
        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isParticipant = conversation.getParticipantOne().getId().equals(user.getId())
                || conversation.getParticipantTwo().getId().equals(user.getId());
        if (!isParticipant) {
            throw new IllegalArgumentException("Access denied");
        }
        return true;
    }

    @Transactional
    public DirectMessageView sendDirectMessage(String senderEmail, Long conversationId, String content) {
        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return doSendDirectMessage(sender, conversationId, content);
    }

    @Transactional
    public DirectMessageView sendDirectMessage(User currentUser, Long conversationId, String content) {
        return doSendDirectMessage(currentUser, conversationId, content);
    }

    /**
     * Core send logic extracted to avoid self-invocation @Transactional bypass.
     * Both public {@code sendDirectMessage} overloads invoke this private method
     * within their own proxy-driven transaction boundaries.
     */
    private DirectMessageView doSendDirectMessage(User currentUser, Long conversationId, String content) {
        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));

        boolean isParticipant = conversation.getParticipantOne().getId().equals(currentUser.getId())
                || conversation.getParticipantTwo().getId().equals(currentUser.getId());
        if (!isParticipant) {
            throw new IllegalArgumentException("Access denied");
        }

        String normalized = content == null ? "" : content.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Message cannot be empty");
        }

        DirectMessage message = new DirectMessage();
        message.setConversation(conversation);
        message.setSender(currentUser);
        message.setContent(normalized);
        DirectMessage saved = directMessageRepository.save(message);

        // Update conversation timestamp
        conversation.setUpdatedAt(OffsetDateTime.now());
        directConversationRepository.save(conversation);

        // Notify the other participant
        User receiver = conversation.getParticipantOne().getId().equals(currentUser.getId())
                ? conversation.getParticipantTwo()
                : conversation.getParticipantOne();
        notificationService.notifyUser(
                receiver.getId(),
                "CHAT_MESSAGE",
                "New message",
                currentUser.getFullName() + " sent a message",
                conversationId);

        return toDirectMessageView(saved);
    }

    public List<DirectConversationResponse> listDirectConversations(User currentUser) {
        List<DirectConversation> asOne = directConversationRepository
                .findByParticipantOneOrderByUpdatedAtDesc(currentUser);
        List<DirectConversation> asTwo = directConversationRepository
                .findByParticipantTwoOrderByUpdatedAtDesc(currentUser);

        List<DirectConversation> all = new ArrayList<>();
        all.addAll(asOne);
        all.addAll(asTwo);
        all.sort(Comparator.comparing(DirectConversation::getUpdatedAt).reversed());

        return all.stream()
                .map(dc -> {
                    User participant = dc.getParticipantOne().getId().equals(currentUser.getId())
                            ? dc.getParticipantTwo()
                            : dc.getParticipantOne();
                    DirectMessage lastMsg = directMessageRepository
                            .findTopByConversationIdOrderByCreatedAtDesc(dc.getId()).orElse(null);
                    int unreadCount = (int) directMessageRepository
                            .countByConversationIdAndSenderEmailNotAndReadByRecipientFalse(dc.getId(), currentUser.getEmail());
                    return new DirectConversationResponse(
                            dc.getId(),
                            participant.getId(),
                            participant.getFullName(),
                            participant.getRole().name(),
                            participant.getSkills() == null ? "" : participant.getSkills(),
                            participant.getProfileImageUrl(),
                            participant.isMentorVerified(),
                            isUserOnline(participant),
                            computePresenceText(participant),
                            lastMsg == null ? "No messages yet" : lastMsg.getContent(),
                            lastMsg == null ? dc.getCreatedAt() : lastMsg.getCreatedAt(),
                            unreadCount);
                })
                .collect(Collectors.toList());
    }

    private boolean isUserOnline(User user) {
        return user.getLastActiveAt() != null
                && user.getLastActiveAt().isAfter(OffsetDateTime.now().minusMinutes(5));
    }

    private DirectMessageView toDirectMessageView(DirectMessage message) {
        return new DirectMessageView(
                message.getId(),
                message.getConversation().getId(),
                message.getSender().getId(),
                message.getSender().getEmail(),
                message.getSender().getFullName(),
                message.getSender().getRole().name(),
                message.getSender().getProfileImageUrl(),
                message.getContent(),
                message.isReadByRecipient(),
                message.getCreatedAt());
    }

    public record ConversationDto(
            Long bookingId,
            String sessionTitle,
            Long participantId,
            String participantName,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            String lastMessagePreview,
            OffsetDateTime lastMessageAt,
            int unreadCount) {
    }

    public record DirectConversationResponse(
            Long conversationId,
            Long participantId,
            String participantName,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            String lastMessagePreview,
            OffsetDateTime lastMessageAt,
            int unreadCount) {
    }

    @Transactional
    public void markDirectMessagesAsRead(Long conversationId, String readerEmail) {
        User reader = userRepository.findByEmail(readerEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        isParticipantInConversation(readerEmail, conversationId);
        directMessageRepository.markAllAsReadByConversationId(conversationId, readerEmail);
    }

    public DirectConversationDetail getDirectConversation(User currentUser, Long conversationId) {
        log.info("[getDirectConversation] conversationId={}, currentUserId={}", conversationId, currentUser.getId());

        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> {
                    log.warn("[getDirectConversation] Conversation not found by ID: {}", conversationId);
                    return new IllegalArgumentException("Conversation not found for ID: " + conversationId);
                });

        Long p1Id = conversation.getParticipantOne().getId();
        Long p2Id = conversation.getParticipantTwo().getId();
        log.debug("[getDirectConversation] Found conversation: participantOneId={}, participantTwoId={}", p1Id, p2Id);

        boolean isParticipant = p1Id.equals(currentUser.getId()) || p2Id.equals(currentUser.getId());
        if (!isParticipant) {
            log.warn("[getDirectConversation] Access denied: user {} is not a participant in conversation {}", currentUser.getId(), conversationId);
            throw new IllegalArgumentException("Access denied for conversation: " + conversationId);
        }

        User participant = p1Id.equals(currentUser.getId()) ? conversation.getParticipantTwo() : conversation.getParticipantOne();
        log.info("[getDirectConversation] Participant resolved: id={}, name={}", participant.getId(), participant.getFullName());

        List<DirectMessageView> messages = directMessageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .map(this::toDirectMessageView)
                .collect(Collectors.toList());
        log.debug("[getDirectConversation] Loaded {} messages for conversation {}", messages.size(), conversationId);

        return new DirectConversationDetail(
                conversation.getId(),
                participant.getId(),
                participant.getFullName(),
                participant.getRole().name(),
                participant.getSkills() == null ? "" : participant.getSkills(),
                participant.getProfileImageUrl(),
                participant.isMentorVerified(),
                isUserOnline(participant),
                computePresenceText(participant),
                messages);
    }

    public record DirectConversationDetail(
            Long conversationId,
            Long participantId,
            String participantName,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            List<DirectMessageView> messages) {
    }

    public record DirectMessageView(
            Long id,
            Long conversationId,
            Long senderId,
            String senderEmail,
            String senderName,
            String senderRole,
            String senderProfileImageUrl,
            String content,
            boolean readByRecipient,
            OffsetDateTime createdAt) {
    }

    public record ChatMessageView(
            Long id,
            Long bookingId,
            Long senderId,
            String senderEmail,
            String senderName,
            String senderRole,
            String senderProfileImageUrl,
            boolean senderVerified,
            String content,
            boolean readByRecipient,
            OffsetDateTime createdAt) {
    }
}
