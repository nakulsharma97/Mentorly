package com.mentorly.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mentorly.booking.BookingRepository;
import com.mentorly.messaging.DirectConversation;
import com.mentorly.messaging.DirectConversationRepository;
import com.mentorly.messaging.DirectMessageRepository;
import com.mentorly.messaging.MessagePrivacy;
import com.mentorly.messaging.MessagingPolicyService;
import com.mentorly.notification.NotificationService;
import com.mentorly.safety.UserBlockRepository;
import com.mentorly.user.MentorVerificationStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the privacy/admin gates on NEW direct-conversation
 * creation (POST /api/v1/chat/direct/{id}). Existing conversations must
 * always remain openable regardless of the receiver's current privacy.
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceDirectConversationTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserBlockRepository userBlockRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private DirectConversationRepository directConversationRepository;
    @Mock
    private DirectMessageRepository directMessageRepository;

    private ChatService chatService;

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                chatMessageRepository,
                bookingRepository,
                userRepository,
                userBlockRepository,
                notificationService,
                directConversationRepository,
                directMessageRepository,
                new ObjectMapper(),
                // Real policy wired to the same repository mocks so the tests
                // exercise the exact production decision path.
                new MessagingPolicyService(directConversationRepository, bookingRepository));
    }

    private User learner(Long id, MessagePrivacy privacy) {
        User user = new User();
        user.setId(id);
        user.setRole(UserRole.LEARNER);
        user.setMessagePrivacy(privacy);
        return user;
    }

    private User approvedMentor(Long id, MessagePrivacy privacy) {
        User user = new User();
        user.setId(id);
        user.setRole(UserRole.MENTOR);
        user.setVerificationStatus(MentorVerificationStatus.APPROVED);
        user.setProfileCompleted(true);
        user.setMessagePrivacy(privacy);
        return user;
    }

    @Test
    void newConversationBlockedWhenReceiverPrivacyIsNobody() {
        User sender = learner(1L, null);
        User receiver = approvedMentor(2L, MessagePrivacy.NOBODY);
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));

        assertThatThrownBy(() -> chatService.createOrGetDirectConversation(sender, 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not accepting");

        verify(directConversationRepository, never()).save(any(DirectConversation.class));
    }

    @Test
    void newConversationBlockedWhenTargetIsAdmin() {
        User sender = learner(1L, null);
        User admin = new User();
        admin.setId(9L);
        admin.setRole(UserRole.ADMIN);
        when(userRepository.findById(9L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> chatService.createOrGetDirectConversation(sender, 9L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be messaged directly");

        verify(directConversationRepository, never()).save(any(DirectConversation.class));
    }

    @Test
    void adminCanNeverSendANewDirectChat() {
        User adminSender = new User();
        adminSender.setId(9L);
        adminSender.setRole(UserRole.ADMIN);
        User target = learner(2L, MessagePrivacy.ANYONE);
        when(userRepository.findById(2L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> chatService.createOrGetDirectConversation(adminSender, 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Admins cannot start direct conversations");

        verify(directConversationRepository, never()).save(any(DirectConversation.class));
    }

    @Test
    void existingConversationStillOpensEvenIfPrivacyIsNobody() {
        User sender = learner(1L, null);
        User receiver = approvedMentor(2L, MessagePrivacy.NOBODY);
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));

        DirectConversation existing = new DirectConversation();
        existing.setId(55L);
        existing.setParticipantOne(sender);
        existing.setParticipantTwo(receiver);
        when(directConversationRepository.findBetweenUsers(sender, receiver))
                .thenReturn(Optional.of(existing));
        when(directMessageRepository.findTopByConversationIdOrderByCreatedAtDesc(55L))
                .thenReturn(Optional.empty());
        when(directMessageRepository
                .countByConversationIdAndSenderEmailNotAndReadByRecipientFalse(eq(55L), any()))
                .thenReturn(0L);

        ChatService.DirectConversationResponse response =
                chatService.createOrGetDirectConversation(sender, 2L);

        assertThat(response.conversationId()).isEqualTo(55L);
        assertThat(response.participantId()).isEqualTo(2L);
        verify(directConversationRepository, never()).save(any(DirectConversation.class));
    }

    @Test
    void newConversationBlockedWhenTargetAccountIsDisabled() {
        User sender = learner(1L, null);
        User receiver = approvedMentor(2L, MessagePrivacy.ANYONE);
        receiver.setEnabled(false);
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));

        assertThatThrownBy(() -> chatService.createOrGetDirectConversation(sender, 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no longer available");

        verify(directConversationRepository, never()).save(any(DirectConversation.class));
    }

    @Test
    void existingConversationCannotReachADisabledAccount() {
        User sender = learner(1L, null);
        User receiver = approvedMentor(2L, MessagePrivacy.ANYONE);
        receiver.setEnabled(false);
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));

        // Account state beats the "existing conversations stay open" rule: a
        // suspended user is not reachable through an old thread either. The
        // existing-conversation lookup is never even reached.
        assertThatThrownBy(() -> chatService.createOrGetDirectConversation(sender, 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no longer available");

        verify(directConversationRepository, never()).findBetweenUsers(any(), any());
    }

    @Test
    void approvedMentorWithAnyonePrivacyCreatesConversation() {
        User sender = learner(1L, null);
        User receiver = approvedMentor(2L, MessagePrivacy.ANYONE);
        when(userRepository.findById(2L)).thenReturn(Optional.of(receiver));
        when(directConversationRepository.save(any(DirectConversation.class))).thenAnswer(inv -> {
            DirectConversation created = inv.getArgument(0);
            created.setId(77L);
            return created;
        });
        when(directMessageRepository.findTopByConversationIdOrderByCreatedAtDesc(77L))
                .thenReturn(Optional.empty());
        when(directMessageRepository
                .countByConversationIdAndSenderEmailNotAndReadByRecipientFalse(eq(77L), any()))
                .thenReturn(0L);

        ChatService.DirectConversationResponse response =
                chatService.createOrGetDirectConversation(sender, 2L);

        assertThat(response.conversationId()).isEqualTo(77L);
        assertThat(response.participantId()).isEqualTo(2L);
        verify(notificationService).notifyUser(
                eq(2L), eq("CHAT_MESSAGE"), anyString(), anyString(), eq(77L));
    }
}
