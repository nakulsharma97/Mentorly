package com.mentorly.messaging;

import com.mentorly.user.User;

import java.time.OffsetDateTime;

/**
 * Immutable, serialization-safe view of a {@link MessageRequest}.
 *
 * <p>Returning the raw JPA entity from the controller is unsafe: with
 * {@code spring.jpa.open-in-view=false} the transaction has already closed by
 * the time Jackson serializes the response, so traversing the LAZY
 * {@code sender}/{@code receiver} associations throws a
 * {@code LazyInitializationException} and the API answers 500 even though the
 * request was persisted. This view snapshots every field inside the
 * transaction so the response is always writable.
 */
public record MessageRequestView(
        Long id,
        String firstMessage,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        ParticipantView sender,
        ParticipantView receiver) {

    /** Flat participant snapshot — never a lazy entity reference. */
    public record ParticipantView(
            Long id,
            String fullName,
            String username,
            String email,
            String role,
            String skills,
            String profileImageUrl,
            OffsetDateTime lastActiveAt) {

        public static ParticipantView from(User user) {
            if (user == null) {
                return null;
            }
            return new ParticipantView(
                    user.getId(),
                    user.getFullName(),
                    user.getDisplayUsername(),
                    user.getEmail(),
                    user.getRole() == null ? null : user.getRole().name(),
                    user.getSkills(),
                    user.getProfileImageUrl(),
                    user.getLastActiveAt());
        }
    }

    public static MessageRequestView from(MessageRequest request) {
        if (request == null) {
            return null;
        }
        return new MessageRequestView(
                request.getId(),
                request.getFirstMessage(),
                request.getStatus() == null ? null : request.getStatus().name(),
                request.getCreatedAt(),
                request.getUpdatedAt(),
                ParticipantView.from(request.getSender()),
                ParticipantView.from(request.getReceiver()));
    }
}
