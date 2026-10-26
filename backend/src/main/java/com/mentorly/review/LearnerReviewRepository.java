package com.mentorly.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * Spring Data repository for {@code LearnerReview} persistence.
 */
public interface LearnerReviewRepository extends JpaRepository<LearnerReview, Long> {
    boolean existsByBookingId(Long bookingId);

    /**
     * Booking ids from the given set that already carry a learner review — one
     * query replaces a per-booking {@code existsByBookingId} round trip.
     */
    @Query("select r.booking.id from LearnerReview r where r.booking.id in :bookingIds")
    List<Long> findReviewedBookingIdsIn(
            @org.springframework.data.repository.query.Param("bookingIds") java.util.Collection<Long> bookingIds);

    /** True when this mentor has already written a review about this learner. */
    boolean existsByLearnerIdAndMentorId(Long learnerId, Long mentorId);

    long countByLearnerId(Long learnerId);

    List<LearnerReview> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    @Query("select coalesce(avg(r.rating), 0) from LearnerReview r where r.learner.id = :learnerId")
    Double averageRatingByLearnerId(Long learnerId);

    @Query("select coalesce(sum(r.rating), 0) from LearnerReview r")
    Double sumRating();

    @Query("SELECT r FROM LearnerReview r JOIN FETCH r.mentor LEFT JOIN FETCH r.booking b"
            + " LEFT JOIN FETCH b.session ORDER BY r.createdAt DESC")
    List<LearnerReview> findAllWithRelations(org.springframework.data.domain.Pageable pageable);
}
