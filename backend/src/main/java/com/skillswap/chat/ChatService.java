package com.skillswap.chat;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.safety.UserBlockRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final UserBlockRepository userBlockRepository;
    private final NotificationService notificationService;

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

    public ChatMessageView createMessage(User currentUser, Long bookingId, String content) {
        Booking booking = getBookingIfParticipant(currentUser, bookingId);
        return toDto(saveMessage(currentUser, booking, content));
    }

    public ChatMessageView createMessage(String userEmail, Long bookingId, String content) {
        User sender = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Booking booking = getBookingIfParticipant(sender, bookingId);
        return toDto(saveMessage(sender, booking, content));
    }

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
