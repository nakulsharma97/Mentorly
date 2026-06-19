package com.skillswap.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MentorReviewRepository extends JpaRepository<MentorReview, Long> {
    boolean existsByBookingId(Long bookingId);

    long countByMentorId(Long mentorId);

    List<MentorReview> findByMentorIdOrderByCreatedAtDesc(Long mentorId);

    @Query("select coalesce(avg(r.rating), 0) from MentorReview r where r.mentor.id = :mentorId")
    Optional<Double> averageRatingByMentorId(Long mentorId);
}
