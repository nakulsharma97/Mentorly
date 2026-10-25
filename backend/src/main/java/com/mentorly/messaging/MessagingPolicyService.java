package com.mentorly.messaging;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Single source of truth for "may this user start a NEW conversation with
 * that user?". Both entry points — message requests
 * ({@link MessageRequestService}) and direct chat creation
 * (ChatService.createOrGetDirectConversation) — delegate here so the two can
 * never drift apart. Admins are never part of the learner/mentor
 * marketplace messaging flow, in either direction.
 */
@Service
@RequiredArgsConstructor
public class MessagingPolicyService {

    private final DirectConversationRepository directConversationRepository;
    private final BookingRepository bookingRepository;

    /**
     * Validates that {@code sender} may open a NEW conversation with
     * {@code receiver} under the receiver's {@link MessagePrivacy} settings.
     * Existing conversations are checked by callers before this point and
     * are never re-validated here.
     *
     * @throws IllegalArgumentException with a user-facing message when refused
     */
    public void assertCanStartConversation(User sender, User receiver) {
        if (sender == null || receiver == null) {
            throw new IllegalArgumentException("Both users are required");
        }
        if (sender.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admins cannot start direct conversations.");
        }
        if (receiver.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admins cannot be messaged directly.");
        }

        MessagePrivacy privacy = receiver.getMessagePrivacy() == null
                ? MessagePrivacy.ANYONE
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
            boolean connected = hasExistingConversation(sender, receiver)
                    || hasAcceptedSession(sender.getId(), receiver.getId());
            if (!connected) {
                throw new IllegalArgumentException("This user only accepts message requests from connected users.");
            }
        }
    }

    /**
     * True when the two users already share a direct conversation — reused by
     * callers that gate features (not just message starts) on an existing
     * relationship.
     */
    public boolean hasExistingConversation(User sender, User receiver) {
        return directConversationRepository.findBetweenUsers(sender, receiver).isPresent();
    }

    /**
     * True when the two users have a booking in a collaborating state
     * (accepted / confirmed / in-progress / completed) in EITHER role
     * direction — shared by CONNECTED_ONLY privacy checks and the search
     * results' {@code canStartDirect} hint so both always agree.
     */
    public boolean hasAcceptedSession(Long currentUserId, Long targetUserId) {
        for (BookingStatus status : List.of(
                BookingStatus.ACCEPTED,
                BookingStatus.CONFIRMED,
                BookingStatus.IN_PROGRESS,
                BookingStatus.COMPLETED)) {
            // current user as learner, target as mentor …
            boolean hasForward = !bookingRepository
                    .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                            currentUserId, targetUserId, status)
                    .isEmpty();
            if (hasForward) {
                return true;
            }
            // … and the reverse: current user as mentor, target as learner.
            boolean hasReverse = !bookingRepository
                    .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                            currentUserId, targetUserId, status)
                    .isEmpty();
            if (hasReverse) {
                return true;
            }
        }
        return false;
    }
}
