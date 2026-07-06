package com.skillswap.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByBookingIdOrderByCreatedAtAsc(Long bookingId);

    List<ChatMessage> findByBookingIdOrderByCreatedAtDesc(Long bookingId, Pageable pageable);

    List<ChatMessage> findByBookingIdAndCreatedAtBeforeOrderByCreatedAtDesc(Long bookingId,
            OffsetDateTime before,
            Pageable pageable);

    ChatMessage findTopByBookingIdOrderByCreatedAtDesc(Long bookingId);

    long countByBookingIdAndSenderEmailNotAndReadByRecipientFalse(Long bookingId, String readerEmail);

    @Modifying
    @Query("""
            update ChatMessage m
            set m.readByRecipient = true
            where m.booking.id = :bookingId
                and m.sender.email <> :readerEmail
                and m.readByRecipient = false
            """)
    int markAllAsReadByBookingId(@Param("bookingId") Long bookingId, @Param("readerEmail") String readerEmail);
}
