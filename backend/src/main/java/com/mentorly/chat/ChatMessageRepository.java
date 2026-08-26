package com.mentorly.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Spring Data repository for {@code ChatMessage} persistence.
 */
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByBookingIdOrderByCreatedAtAsc(Long bookingId);

    List<ChatMessage> findByBookingIdOrderByCreatedAtDesc(Long bookingId, Pageable pageable);

    List<ChatMessage> findByBookingIdAndCreatedAtBeforeOrderByCreatedAtDesc(Long bookingId,
            OffsetDateTime before,
            Pageable pageable);

    ChatMessage findTopByBookingIdOrderByCreatedAtDesc(Long bookingId);

    /**
     * Batch-fetch the last message for each booking in a single query.
     * Uses a subquery to find the max (latest) message id per booking.
     *
     * @param bookingIds list of booking IDs to fetch last messages for
     * @return list of last messages per booking (one per booking)
     */
    @Query("""
            SELECT m FROM ChatMessage m
            WHERE m.id IN (
                SELECT MAX(m2.id) FROM ChatMessage m2
                WHERE m2.booking.id IN :bookingIds
                GROUP BY m2.booking.id
            )
            """)
    List<ChatMessage> findLastMessagesByBookingIds(@Param("bookingIds") List<Long> bookingIds);

    /**
     * Batch-count unread messages (not yet read by the recipient) per booking,
     * in a single query. Returns rows of [bookingId, unreadCount].
     */
    @Query("""
            SELECT m.booking.id, COUNT(m) FROM ChatMessage m
            WHERE m.booking.id IN :bookingIds AND m.readByRecipient = false
            GROUP BY m.booking.id
            """)
    List<Object[]> countUnreadByBookingIds(@Param("bookingIds") List<Long> bookingIds);

    long countByBookingIdAndSenderEmailNotAndReadByRecipientFalse(Long bookingId, String readerEmail);

    /** Count of distinct bookings with at least one chat message — active conversations KPI. */
    @Query("SELECT COUNT(DISTINCT m.booking.id) FROM ChatMessage m")
    long countDistinctBookingIds();

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
