package com.skillswap.chat;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.safety.UserBlockRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final UserBlockRepository userBlockRepository;
    private final NotificationService notificationService;

    public List<ChatMessageView> listMessages(User currentUser, Long bookingId) {
        Booking booking = getBookingIfParticipant(currentUser, bookingId);
        return chatMessageRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()).stream()
                .map(this::toView)
                .toList();
    }

    public ChatMessageView createMessage(User currentUser, Long bookingId, String content) {
        Booking booking = getBookingIfParticipant(currentUser, bookingId);
        return saveMessage(currentUser, booking, content);
    }

    public ChatMessageView createMessage(String userEmail, Long bookingId, String content) {
        User sender = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Booking booking = getBookingIfParticipant(sender, bookingId);
        return saveMessage(sender, booking, content);
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

    private ChatMessageView saveMessage(User sender, Booking booking, String content) {
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

        return toView(saved);
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

    private ChatMessageView toView(ChatMessage message) {
        return new ChatMessageView(
                message.getId(),
                message.getBooking().getId(),
                message.getSender().getId(),
                message.getSender().getEmail(),
                message.getSender().getFullName(),
                message.getContent(),
                message.isReadByRecipient(),
                message.getCreatedAt() == null ? OffsetDateTime.now() : message.getCreatedAt());
    }

    public record ChatMessageView(
            Long id,
            Long bookingId,
            Long senderId,
            String senderEmail,
            String senderName,
            String content,
            boolean readByRecipient,
            OffsetDateTime createdAt) {
    }
}
