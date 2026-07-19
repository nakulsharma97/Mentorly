package com.skillswap.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface LearnerReviewRepository extends JpaRepository<LearnerReview, Long> {
    boolean existsByBookingId(Long bookingId);

    long countByLearnerId(Long learnerId);

    List<LearnerReview> findByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    @Query("select coalesce(avg(r.rating), 0) from LearnerReview r where r.learner.id = :learnerId")
    Double averageRatingByLearnerId(Long learnerId);

    @Query("select coalesce(sum(r.rating), 0) from LearnerReview r")
    Double sumRating();

    @Query("SELECT r FROM LearnerReview r JOIN FETCH r.mentor LEFT JOIN FETCH r.booking b LEFT JOIN FETCH b.session ORDER BY r.createdAt DESC")
    List<LearnerReview> findAllWithRelations(org.springframework.data.domain.Pageable pageable);
}
