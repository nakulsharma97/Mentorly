package com.skillswap.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code MentorReview} persistence.
 */
public interface MentorReviewRepository extends JpaRepository<MentorReview, Long> {
    boolean existsByBookingId(Long bookingId);

    Optional<MentorReview> findByBookingId(Long bookingId);

    long countByMentorId(Long mentorId);

    List<MentorReview> findByMentorIdOrderByCreatedAtDesc(Long mentorId);

    @Query("select coalesce(avg(r.rating), 0) from MentorReview r where r.mentor.id = :mentorId")
    Optional<Double> averageRatingByMentorId(Long mentorId);

    @Query("select coalesce(sum(r.rating), 0) from MentorReview r")
    Double sumRating();

    @Query("SELECT r FROM MentorReview r JOIN FETCH r.learner LEFT JOIN FETCH r.booking b"
            + " LEFT JOIN FETCH b.session ORDER BY r.createdAt DESC")
    List<MentorReview> findAllWithRelations(org.springframework.data.domain.Pageable pageable);
}
