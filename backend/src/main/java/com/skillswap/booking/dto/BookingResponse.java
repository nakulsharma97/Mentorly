package com.skillswap.booking.dto;

import com.skillswap.booking.BookingStatus;
import com.skillswap.payment.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * DTO for booking response with admin approval information.
 */
/**
 * Encapsulates booking response.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingResponse {

    private Long id;

    private Long sessionId;

    private String sessionTitle;

    private Long learnerId;

    private String learnerName;

    private String learnerUsername;

    private Long mentorId;

    private String mentorName;

    private String mentorUsername;

    private BookingStatus bookingStatus;

    private PaymentStatus paymentStatus;

    private Boolean approvedByAdmin;

    private OffsetDateTime approvedAt;

    private OffsetDateTime joinedAt;

    private OffsetDateTime createdAt;

    // Helper field for UI
    private boolean canJoin;
}
