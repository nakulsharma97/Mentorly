package com.mentorly.messaging;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessagingPolicyServiceTest {

    @Mock
    private DirectConversationRepository directConversationRepository;

    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private MessagingPolicyService messagingPolicyService;

    private User user(Long id, UserRole role, MessagePrivacy privacy) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setMessagePrivacy(privacy);
        return user;
    }

    // ── ANYONE ──

    @Test
    void anyonePrivacyAllowsNewConversation() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.ANYONE);

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    @Test
    void nullPrivacyTreatedAsAnyone() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.LEARNER, null);

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    // ── NOBODY ──

    @Test
    void nobodyPrivacyBlocksNewConversation() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.NOBODY);

        assertThatThrownBy(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not accepting");
    }

    // ── MENTORS_ONLY / LEARNERS_ONLY ──

    @Test
    void mentorsOnlyBlocksLearnerSender() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.MENTORS_ONLY);

        assertThatThrownBy(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("from mentors");
    }

    @Test
    void mentorsOnlyAllowsMentorSender() {
        User sender = user(1L, UserRole.MENTOR, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.MENTORS_ONLY);

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    @Test
    void learnersOnlyBlocksMentorSender() {
        User sender = user(1L, UserRole.MENTOR, null);
        User receiver = user(2L, UserRole.LEARNER, MessagePrivacy.LEARNERS_ONLY);

        assertThatThrownBy(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("from learners");
    }

    @Test
    void learnersOnlyAllowsLearnerSender() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.LEARNER, MessagePrivacy.LEARNERS_ONLY);

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    // ── CONNECTED_ONLY ──

    @Test
    void connectedOnlyBlocksStrangers() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.CONNECTED_ONLY);
        when(directConversationRepository.findBetweenUsers(sender, receiver))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("connected users");
    }

    @Test
    void connectedOnlyAllowsExistingConversation() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.CONNECTED_ONLY);
        when(directConversationRepository.findBetweenUsers(sender, receiver))
                .thenReturn(Optional.of(new DirectConversation()));

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    @Test
    void connectedOnlyAllowsWhenSenderIsLearnerWithBooking() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.CONNECTED_ONLY);
        when(bookingRepository
                .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                        1L, 2L, BookingStatus.ACCEPTED))
                .thenReturn(List.of(new Booking()));

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    @Test
    void connectedOnlyAllowsWhenSenderIsMentorWithBooking() {
        // Reverse role direction: sender is the mentor, receiver the learner.
        // The status loop visits ACCEPTED → CONFIRMED → IN_PROGRESS →
        // COMPLETED, so stub every visit (consecutive values) — Mockito strict
        // stubbing rejects a same-method call with unstubbed arguments.
        User sender = user(3L, UserRole.MENTOR, null);
        User receiver = user(4L, UserRole.LEARNER, MessagePrivacy.CONNECTED_ONLY);
        when(bookingRepository
                .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                        eq(3L), eq(4L), any(BookingStatus.class)))
                .thenReturn(List.of(), List.of(), List.of(), List.of(new Booking()));

        assertThatCode(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .doesNotThrowAnyException();
    }

    // ── ADMIN ban ──

    @Test
    void adminReceiverIsRejected() {
        User sender = user(1L, UserRole.LEARNER, null);
        User receiver = user(9L, UserRole.ADMIN, null);

        assertThatThrownBy(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be messaged directly");
    }

    @Test
    void adminSenderIsRejected() {
        User sender = user(9L, UserRole.ADMIN, null);
        User receiver = user(2L, UserRole.MENTOR, MessagePrivacy.ANYONE);

        assertThatThrownBy(() -> messagingPolicyService.assertCanStartConversation(sender, receiver))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Admins cannot start direct conversations");
    }
}
