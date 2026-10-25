package com.mentorly.sitereview;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SiteReviewRepository extends JpaRepository<SiteReview, Long> {

    Optional<SiteReview> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    Page<SiteReview> findByStatus(SiteReviewStatus status, Pageable pageable);

    /** Eagerly fetches the author (needed to render reviewer name/role in the public list). */
    @Query("SELECT r FROM SiteReview r JOIN FETCH r.user WHERE r.status = :status ORDER BY r.createdAt DESC")
    List<SiteReview> findByStatusWithUser(@Param("status") SiteReviewStatus status, Pageable pageable);
}
