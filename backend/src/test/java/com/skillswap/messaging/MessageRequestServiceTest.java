package com.skillswap.messaging;

import com.skillswap.booking.BookingRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageRequestServiceTest {

    @Mock
    private MessageRequestRepository messageRequestRepository;

    @Mock
    private DirectConversationRepository directConversationRepository;

    @Mock
    private DirectMessageRepository directMessageRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private MessageRequestService messageRequestService;

    private User user(Long id, String role) {
        User user = new User();
        user.setId(id);
        user.setFullName("Test User " + id);
        user.setRole(com.skillswap.user.UserRole.valueOf(role));
        user.setMessagePrivacy(MessagePrivacy.ANYONE);
        return user;
    }

    @Test
    void createRejectsRequestToAdmin() {
        User sender = user(1L, "LEARNER");
        User receiver = user(2L, "ADMIN");

        assertThatThrownBy(() -> messageRequestService.createRequest(sender, receiver, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("learners or mentors");

        verify(messageRequestRepository, never()).save(any());
    }

    @Test
    void createRejectsRequestFromAdmin() {
        User sender = user(1L, "ADMIN");
        User receiver = user(2L, "LEARNER");

        assertThatThrownBy(() -> messageRequestService.createRequest(sender, receiver, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Admins cannot send");

        verify(messageRequestRepository, never()).save(any());
    }

    @Test
    void createRejectsWhenReceiverBlocksNewRequests() {
        User sender = user(1L, "LEARNER");
        User receiver = user(2L, "MENTOR");
        receiver.setMessagePrivacy(MessagePrivacy.NOBODY);

        assertThatThrownBy(() -> messageRequestService.createRequest(sender, receiver, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not accepting");

        verify(messageRequestRepository, never()).save(any());
    }

    @Test
    void createRejectsDuplicatePendingRequest() {
        User sender = user(1L, "LEARNER");
        User receiver = user(2L, "MENTOR");
        MessageRequest pending = new MessageRequest();
        pending.setStatus(MessageRequestStatus.PENDING);
        pending.setCreatedAt(OffsetDateTime.now());
        when(messageRequestRepository.findTopBySenderIdAndReceiverIdOrderByCreatedAtDesc(1L, 2L))
                .thenReturn(pending);

        assertThatThrownBy(() -> messageRequestService.createRequest(sender, receiver, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already pending");
    }

    @Test
    void declineBlocksNewRequestForTwentyFourHours() {
        User sender = user(1L, "LEARNER");
        User receiver = user(2L, "MENTOR");
        MessageRequest declined = new MessageRequest();
        declined.setStatus(MessageRequestStatus.DECLINED);
        declined.setCreatedAt(OffsetDateTime.now().minusHours(2));
        when(messageRequestRepository.findTopBySenderIdAndReceiverIdOrderByCreatedAtDesc(1L, 2L))
                .thenReturn(declined);

        assertThatThrownBy(() -> messageRequestService.createRequest(sender, receiver, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("24 hours");
    }
}
