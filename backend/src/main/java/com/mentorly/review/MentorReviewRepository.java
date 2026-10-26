package com.mentorly.review;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code MentorReview} persistence.
 */
public interface MentorReviewRepository extends JpaRepository<MentorReview, Long> {
    boolean existsByBookingId(Long bookingId);

    /**
     * Booking ids from the given set that already carry a mentor review — one
     * query replaces a per-booking {@code existsByBookingId} round trip.
     */
    @Query("select r.booking.id from MentorReview r where r.booking.id in :bookingIds")
    List<Long> findReviewedBookingIdsIn(
            @org.springframework.data.repository.query.Param("bookingIds") java.util.Collection<Long> bookingIds);

    /** Rating histogram for one mentor — one GROUP BY replaces five full-list scans. */
    @Query("select r.rating, count(r) from MentorReview r where r.mentor.id = :mentorId group by r.rating")
    List<Object[]> countByRatingForMentorId(
            @org.springframework.data.repository.query.Param("mentorId") Long mentorId);

    Optional<MentorReview> findByBookingId(Long bookingId);

    long countByMentorId(Long mentorId);

    List<MentorReview> findByMentorIdOrderByCreatedAtDesc(Long mentorId);

    Page<MentorReview> findByMentorIdOrderByCreatedAtDesc(Long mentorId, Pageable pageable);

    @Query("select coalesce(avg(r.rating), 0) from MentorReview r where r.mentor.id = :mentorId")
    Optional<Double> averageRatingByMentorId(Long mentorId);

    @Query("select r.mentor.id, coalesce(avg(r.rating), 0) from MentorReview r"
            + " where r.mentor.id in :mentorIds group by r.mentor.id")
    List<Object[]> averageRatingByMentorIdsIn(
            @org.springframework.data.repository.query.Param("mentorIds") java.util.Collection<Long> mentorIds);

    @Query("select r.mentor.id, count(r) from MentorReview r"
            + " where r.mentor.id in :mentorIds group by r.mentor.id")
    List<Object[]> countByMentorIdsIn(
            @org.springframework.data.repository.query.Param("mentorIds") java.util.Collection<Long> mentorIds);

    @Query("select coalesce(sum(r.rating), 0) from MentorReview r")
    Double sumRating();

    @Query("SELECT r FROM MentorReview r JOIN FETCH r.learner LEFT JOIN FETCH r.booking b"
            + " LEFT JOIN FETCH b.session ORDER BY r.createdAt DESC")
    List<MentorReview> findAllWithRelations(org.springframework.data.domain.Pageable pageable);
}
