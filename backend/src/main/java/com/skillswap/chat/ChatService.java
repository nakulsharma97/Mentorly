package com.skillswap.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.messaging.DirectMessage;
import com.skillswap.messaging.DirectMessageRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.safety.UserBlockRepository;
import com.skillswap.session.SkillSession;
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
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service implementing chat business logic.
 */
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
    private final ObjectMapper objectMapper;

    public List<ConversationDto> listConversations(User currentUser, String query, String filter) {
        List<Booking> bookings = loadBookingsForUser(currentUser);

        // One conversation per user PAIR — every booking with the same peer
        // groups into a single row so repeated sessions never create duplicate
        // chats (Pritil Thakur appears once, not once per booked session).
        Map<Long, ConversationDto> byParticipant = new LinkedHashMap<>();
        for (Booking booking : bookings) {
            User participant = getConversationParticipant(currentUser, booking);
            ConversationDto row = toConversation(currentUser, booking);
            byParticipant.merge(participant.getId(), row, this::mergeConversationRows);
        }

        return byParticipant.values().stream()
                .filter(conversation -> filterConversation(conversation, query, filter))
                .sorted((a, b) -> b.lastMessageAt().compareTo(a.lastMessageAt()))
                .collect(Collectors.toList());
    }

    /**
     * Merges two booking-chat rows that share the same participant pair. The
     * row with the most recent activity becomes the live row (its booking is
     * the one the UI opens), unread totals are summed, and the session count
     * accumulates — no messages are ever lost, every booking stays readable.
     */
    private ConversationDto mergeConversationRows(ConversationDto a, ConversationDto b) {
        ConversationDto recent = a.lastMessageAt().compareTo(b.lastMessageAt()) >= 0 ? a : b;
        return new ConversationDto(
                recent.bookingId(),
                recent.sessionTitle(),
                recent.participantId(),
                recent.participantName(),
                recent.participantUsername(),
                recent.participantRole(),
                recent.participantSkills(),
                recent.participantProfileImageUrl(),
                recent.participantVerified(),
                recent.participantOnline(),
                recent.participantPresenceText(),
                recent.participantEmail(),
                recent.lastMessagePreview(),
                recent.lastMessageAt(),
                a.unreadCount() + b.unreadCount(),
                recent.bookingStatus(),
                recent.startTime(),
                recent.durationMinutes(),
                recent.paymentStatus(),
                recent.meetingLink(),
                recent.meetingPlatform(),
                a.sessionCount() + b.sessionCount());
    }

    /**
     * Unified conversation search across booking chats AND direct chats.
     * Matches participant name, username, email, skills, session title,
     * conversation id, booking id, and the last message preview.
     */
    public List<UnifiedConversationDto> searchConversations(User currentUser, String query) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            return List.of();
        }

        List<UnifiedConversationDto> results = new ArrayList<>();

        // Booking chats — grouped by user pair (one row per peer, never one
        // per session), matching the conversation list the sidebar shows.
        for (ConversationDto conv : listConversations(currentUser, null, null)) {
            if (matchesSearch(conv, q)) {
                results.add(UnifiedConversationDto.fromBooking(conv));
            }
        }

        // Direct chats
        for (DirectConversationResponse dc : listDirectConversations(currentUser)) {
            if (matchesDirectSearch(dc, q)) {
                results.add(UnifiedConversationDto.fromDirect(dc));
            }
        }

        results.sort(Comparator.comparing(UnifiedConversationDto::lastMessageAt).reversed());
        return results;
    }

    private static boolean matchesSearch(ConversationDto conv, String q) {
        return contains(conv.participantName(), q)
                || contains(conv.participantUsername(), q)
                || contains(conv.participantRole(), q)
                || contains(conv.participantEmail(), q)
                || contains(conv.participantSkills(), q)
                || contains(conv.sessionTitle(), q)
                || contains(conv.lastMessagePreview(), q)
                || String.valueOf(conv.bookingId()).contains(q);
    }

    private static boolean matchesDirectSearch(DirectConversationResponse dc, String q) {
        return contains(dc.participantName(), q)
                || contains(dc.participantUsername(), q)
                || contains(dc.participantRole(), q)
                || contains(dc.participantEmail(), q)
                || contains(dc.participantSkills(), q)
                || contains(dc.lastMessagePreview(), q)
                || String.valueOf(dc.conversationId()).contains(q);
    }

    private static boolean contains(String value, String q) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(q);
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
        String sanitized = ChatInputSanitizer.sanitize(content);
        ChatInputSanitizer.validate(sanitized);

        ChatMessage message = new ChatMessage();
        message.setBooking(booking);
        message.setSender(sender);
        message.setContent(sanitized);
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

        SkillSession session = booking.getSession();
        return new ConversationDto(
                booking.getId(),
                session.getTitle(),
                participant.getId(),
                participant.getFullName(),
                participant.getDisplayUsername(),
                participant.getRole().name(),
                participant.getSkills() == null ? "" : participant.getSkills(),
                participant.getProfileImageUrl(),
                participant.isMentorVerified(),
                online,
                computePresenceText(participant),
                participant.getEmail(),
                lastPreview,
                lastAt,
                unreadCount,
                booking.getBookingStatus().name(),
                session.getStartTime(),
                session.getDurationMinutes(),
                booking.getPaymentStatus() == null ? null : booking.getPaymentStatus().name(),
                session.getMeetingLink(),
                session.getMeetingProvider() == null ? null : session.getMeetingProvider().name(),
                1);
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
                message.getSender().getDisplayUsername(),
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

        // Check if direct conversation already exists — never create duplicates.
        // Existing conversations stay fully accessible even if the mentor was
        // later suspended/rejected (only NEW conversations are gated below).
        Optional<DirectConversation> existing = directConversationRepository.findBetweenUsers(currentUser, target);
        if (existing.isPresent()) {
            return toDirectConversationResponse(currentUser, existing.get());
        }

        // Marketplace gate — only admin-APPROVED mentors may receive NEW learner
        // conversations. Placed after the existing-conversation lookup so opening
        // a previous chat is never blocked.
        if (target.getRole() == UserRole.MENTOR && !target.isApprovedMentor()) {
            throw new IllegalArgumentException("This mentor is currently unavailable for messaging.");
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

        return toDirectConversationResponse(currentUser, saved);
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
     * Deletes one of the caller's own direct messages. Only the sender may
     * delete; the other participant sees the message disappear on next load.
     */
    @Transactional
    public boolean deleteDirectMessage(User currentUser, Long conversationId, Long messageId) {
        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        ensureParticipant(conversation, currentUser);

        DirectMessage message = directMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!message.getConversation().getId().equals(conversationId)) {
            throw new IllegalArgumentException("Message does not belong to this conversation");
        }
        if (!message.getSender().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("You can only delete your own messages");
        }
        directMessageRepository.delete(message);
        return true;
    }

    /**
     * Deletes one of the caller's own booking-chat messages.
     */
    @Transactional
    public boolean deleteBookingMessage(User currentUser, Long bookingId, Long messageId) {
        Booking booking = getBookingIfParticipant(currentUser, bookingId);
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!message.getBooking().getId().equals(bookingId)) {
            throw new IllegalArgumentException("Message does not belong to this booking");
        }
        if (!message.getSender().getId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("You can only delete your own messages");
        }
        chatMessageRepository.delete(message);
        return true;
    }

    /**
     * Toggles an emoji reaction by the current user on a direct message.
     * Reactions are stored as a JSON object mapping emoji -> [userIds].
     */
    @Transactional
    public DirectMessageView toggleReaction(User currentUser, Long conversationId, Long messageId, String emoji) {
        if (emoji == null || emoji.isBlank()) {
            throw new IllegalArgumentException("Emoji is required");
        }
        String cleanEmoji = emoji.trim();
        if (cleanEmoji.length() > 8) {
            throw new IllegalArgumentException("Emoji must be a single emoji");
        }

        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        ensureParticipant(conversation, currentUser);

        DirectMessage message = directMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        if (!message.getConversation().getId().equals(conversationId)) {
            throw new IllegalArgumentException("Message does not belong to this conversation");
        }

        try {
            Map<String, List<Long>> reactions = new java.util.HashMap<>();
            String raw = message.getReactions();
            if (raw != null && !raw.isBlank()) {
                reactions = objectMapper.readValue(raw,
                        new com.fasterxml.jackson.core.type.TypeReference<Map<String, List<Long>>>() {
                        });
            }
            List<Long> users = new ArrayList<>(reactions.getOrDefault(cleanEmoji, List.of()));
            boolean removed = users.removeIf(id -> id.equals(currentUser.getId()));
            if (!removed) {
                users.add(currentUser.getId());
            }
            if (users.isEmpty()) {
                reactions.remove(cleanEmoji);
            } else {
                reactions.put(cleanEmoji, users);
            }
            message.setReactions(reactions.isEmpty() ? null : objectMapper.writeValueAsString(reactions));
            directMessageRepository.save(message);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Could not update reactions", ex);
        }

        return toDirectMessageView(message);
    }

    /**
     * Pins or unpins a direct conversation for the current user.
     */
    @Transactional
    public DirectConversationResponse setPinned(User currentUser, Long conversationId, boolean pinned) {
        DirectConversation conversation = findConversationFor(currentUser, conversationId);
        conversation.setPinned(pinned);
        directConversationRepository.save(conversation);
        return toDirectConversationResponse(currentUser, conversation);
    }

    /**
     * Archives or unarchives a direct conversation for the current user.
     */
    @Transactional
    public DirectConversationResponse setArchived(User currentUser, Long conversationId, boolean archived) {
        DirectConversation conversation = findConversationFor(currentUser, conversationId);
        conversation.setArchived(archived);
        directConversationRepository.save(conversation);
        return toDirectConversationResponse(currentUser, conversation);
    }

    private DirectConversation findConversationFor(User currentUser, Long conversationId) {
        DirectConversation conversation = directConversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        ensureParticipant(conversation, currentUser);
        return conversation;
    }

    private static void ensureParticipant(DirectConversation conversation, User user) {
        boolean isParticipant = conversation.getParticipantOne().getId().equals(user.getId())
                || conversation.getParticipantTwo().getId().equals(user.getId());
        if (!isParticipant) {
            throw new IllegalArgumentException("Access denied");
        }
    }

    /**
     * Lightweight check — validates the user is a participant in a direct
     * conversation
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

        String sanitized = ChatInputSanitizer.sanitize(content);
        ChatInputSanitizer.validate(sanitized);

        DirectMessage message = new DirectMessage();
        message.setConversation(conversation);
        message.setSender(currentUser);
        message.setContent(sanitized);
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
                .map(dc -> toDirectConversationResponse(currentUser, dc))
                .collect(Collectors.toList());
    }

    /** Shared mapper so list/create/pin/archive all return the same shape. */
    private DirectConversationResponse toDirectConversationResponse(User currentUser, DirectConversation dc) {
        User participant = dc.getParticipantOne().getId().equals(currentUser.getId())
                ? dc.getParticipantTwo()
                : dc.getParticipantOne();
        DirectMessage lastMsg = directMessageRepository
                .findTopByConversationIdOrderByCreatedAtDesc(dc.getId()).orElse(null);
        int unreadCount = (int) directMessageRepository
                .countByConversationIdAndSenderEmailNotAndReadByRecipientFalse(
                        dc.getId(), currentUser.getEmail());
        return new DirectConversationResponse(
                dc.getId(),
                participant.getId(),
                participant.getFullName(),
                participant.getDisplayUsername(),
                participant.getRole().name(),
                participant.getSkills() == null ? "" : participant.getSkills(),
                participant.getProfileImageUrl(),
                participant.isMentorVerified(),
                isUserOnline(participant),
                computePresenceText(participant),
                participant.getEmail(),
                lastMsg == null ? "No messages yet" : lastMsg.getContent(),
                lastMsg == null ? dc.getCreatedAt() : lastMsg.getCreatedAt(),
                unreadCount,
                dc.isPinned(),
                dc.isArchived());
    }

    private boolean isUserOnline(User user) {
        return user.getLastActiveAt() != null
                && user.getLastActiveAt().isAfter(OffsetDateTime.now().minusMinutes(5));
    }

    private DirectMessageView toDirectMessageView(DirectMessage message) {
        Map<String, List<Long>> reactions = parseReactions(message.getReactions());
        return new DirectMessageView(
                message.getId(),
                message.getConversation().getId(),
                message.getSender().getId(),
                message.getSender().getEmail(),
                message.getSender().getFullName(),
                message.getSender().getDisplayUsername(),
                message.getSender().getRole().name(),
                message.getSender().getProfileImageUrl(),
                message.getContent(),
                message.isReadByRecipient(),
                message.getCreatedAt(),
                reactions);
    }

    private Map<String, List<Long>> parseReactions(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(raw,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, List<Long>>>() {
                    });
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    /**
     * Immutable data carrier for conversation.
     */
    public record ConversationDto(
            Long bookingId,
            String sessionTitle,
            Long participantId,
            String participantName,
            String participantUsername,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            String participantEmail,
            String lastMessagePreview,
            OffsetDateTime lastMessageAt,
            int unreadCount,
            String bookingStatus,
            OffsetDateTime startTime,
            Long durationMinutes,
            String paymentStatus,
            String meetingLink,
            String meetingPlatform,
            int sessionCount) {
    }

    /**
     * Immutable data carrier for direct conversation response.
     */
    public record DirectConversationResponse(
            Long conversationId,
            Long participantId,
            String participantName,
            String participantUsername,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            String participantEmail,
            String lastMessagePreview,
            OffsetDateTime lastMessageAt,
            int unreadCount,
            boolean pinned,
            boolean archived) {
    }

    /**
     * Immutable data carrier for a unified conversation search result.
     * Normalizes booking chats and direct chats into a single shape so the
     * messaging search can render both types identically.
     */
    public record UnifiedConversationDto(
            String kind, // "booking" | "direct"
            Long id, // bookingId for booking, conversationId for direct
            Long participantId,
            String participantName,
            String participantUsername,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            String participantEmail,
            String sessionTitle,
            String lastMessagePreview,
            OffsetDateTime lastMessageAt,
            int unreadCount) {

        static UnifiedConversationDto fromBooking(ConversationDto conv) {
            return new UnifiedConversationDto(
                    "booking",
                    conv.bookingId(),
                    conv.participantId(),
                    conv.participantName(),
                    conv.participantUsername(),
                    conv.participantRole(),
                    conv.participantSkills(),
                    conv.participantProfileImageUrl(),
                    conv.participantVerified(),
                    conv.participantOnline(),
                    conv.participantPresenceText(),
                    conv.participantEmail(),
                    conv.sessionTitle(),
                    conv.lastMessagePreview(),
                    conv.lastMessageAt(),
                    conv.unreadCount());
        }

        static UnifiedConversationDto fromDirect(DirectConversationResponse dc) {
            return new UnifiedConversationDto(
                    "direct",
                    dc.conversationId(),
                    dc.participantId(),
                    dc.participantName(),
                    dc.participantUsername(),
                    dc.participantRole(),
                    dc.participantSkills(),
                    dc.participantProfileImageUrl(),
                    dc.participantVerified(),
                    dc.participantOnline(),
                    dc.participantPresenceText(),
                    dc.participantEmail(),
                    "",
                    dc.lastMessagePreview(),
                    dc.lastMessageAt(),
                    dc.unreadCount());
        }
    }

    @Transactional
    public void markDirectMessagesAsRead(Long conversationId, String readerEmail) {
        userRepository.findByEmail(readerEmail)
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
            log.warn("[getDirectConversation] Access denied: user {} is not a participant"
                    + " in conversation {}", currentUser.getId(), conversationId);
            throw new IllegalArgumentException("Access denied for conversation: " + conversationId);
        }

        User participant = p1Id.equals(currentUser.getId())
                ? conversation.getParticipantTwo()
                : conversation.getParticipantOne();
        log.info("[getDirectConversation] Participant resolved: id={}, name={}",
                participant.getId(), participant.getFullName());

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
                participant.getDisplayUsername(),
                participant.getRole().name(),
                participant.getSkills() == null ? "" : participant.getSkills(),
                participant.getProfileImageUrl(),
                participant.isMentorVerified(),
                isUserOnline(participant),
                computePresenceText(participant),
                messages);
    }

    /**
     * Immutable data carrier for direct conversation detail.
     */
    public record DirectConversationDetail(
            Long conversationId,
            Long participantId,
            String participantName,
            String participantUsername,
            String participantRole,
            String participantSkills,
            String participantProfileImageUrl,
            boolean participantVerified,
            boolean participantOnline,
            String participantPresenceText,
            List<DirectMessageView> messages) {
    }

    /**
     * Immutable data carrier for direct message view.
     */
    public record DirectMessageView(
            Long id,
            Long conversationId,
            Long senderId,
            String senderEmail,
            String senderName,
            String senderUsername,
            String senderRole,
            String senderProfileImageUrl,
            String content,
            boolean readByRecipient,
            OffsetDateTime createdAt,
            Map<String, List<Long>> reactions) {
    }

    /**
     * Immutable data carrier for chat message view.
     */
    public record ChatMessageView(
            Long id,
            Long bookingId,
            Long senderId,
            String senderEmail,
            String senderName,
            String senderUsername,
            String senderRole,
            String senderProfileImageUrl,
            boolean senderVerified,
            String content,
            boolean readByRecipient,
            OffsetDateTime createdAt) {
    }
}
