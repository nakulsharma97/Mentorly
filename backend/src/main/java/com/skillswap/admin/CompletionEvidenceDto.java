package com.skillswap.admin;

import com.skillswap.booking.CompletionReviewStatus;
import com.skillswap.booking.ConfirmationStatus;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * DTO returned by the admin evidence endpoint for session completion disputes.
 * Contains all information needed for an admin to make an informed decision
 * without claiming any technical certainty the system doesn't have.
 */
public record CompletionEvidenceDto(
        // Booking identity
        Long bookingId,
        String sessionTitle,

        // Scheduled session times
        OffsetDateTime scheduledStartTime,
        OffsetDateTime scheduledEndTime,

        // Participant identities
        String learnerName,
        String learnerEmail,
        String mentorName,
        String mentorEmail,

        // Join-link-request signals (null if never requested)
        OffsetDateTime learnerJoinLinkRequestedAt,
        OffsetDateTime mentorJoinLinkRequestedAt,
        boolean learnerNeverRequestedJoinLink,
        boolean mentorNeverRequestedJoinLink,

        // Confirmation statuses + timestamps
        ConfirmationStatus learnerConfirmationStatus,
        ConfirmationStatus mentorConfirmationStatus,
        OffsetDateTime learnerConfirmedAt,
        OffsetDateTime mentorConfirmedAt,

        // Dispute reasons (if any)
        String learnerDisputeReason,
        String mentorDisputeReason,

        // Overall review status
        CompletionReviewStatus completionReviewStatus,

        // Chat messages during the session window (for evidence)
        List<ChatMessageSnapshot> sessionChatMessages,

        // Historical dispute counts for both participants
        long learnerPastDisputeCount,
        long mentorPastDisputeCount
) {
    /**
     * Lightweight snapshot of a chat message during the session window.
     */
    public record ChatMessageSnapshot(
            Long id,
            String senderName,
            String senderRole,
            String content,
            OffsetDateTime sentAt
    ) {}
}
