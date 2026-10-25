package com.mentorly.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.review.LearnerReviewRepository;
import com.mentorly.review.MentorReviewRepository;
import com.mentorly.sitereview.SiteReview;
import com.mentorly.sitereview.SiteReviewRepository;
import com.mentorly.sitereview.SiteReviewStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;

/**
 * Verifies the public testimonials list merges APPROVED site reviews
 * ("Share your review" feature) into the unchanged ReviewDto shape.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestimonialsServiceSiteReviewTest {

    @Mock
    private MentorReviewRepository mentorReviewRepository;

    @Mock
    private LearnerReviewRepository learnerReviewRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private SiteReviewRepository siteReviewRepository;

    @InjectMocks
    private TestimonialsService service;

    @BeforeEach
    void setUp() {
        when(mentorReviewRepository.findAllWithRelations(any(Pageable.class))).thenReturn(List.of());
        when(learnerReviewRepository.findAllWithRelations(any(Pageable.class))).thenReturn(List.of());
    }

    private SiteReview siteReview(Long id, User author, OffsetDateTime createdAt, String comment) {
        SiteReview review = new SiteReview();
        review.setId(id);
        review.setUser(author);
        review.setRating(5);
        review.setTitle("Love it");
        review.setComment(comment);
        review.setStatus(SiteReviewStatus.APPROVED);
        review.setCreatedAt(createdAt);
        return review;
    }

    private User author(long id, String name) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        user.setRole(UserRole.LEARNER);
        return user;
    }

    @Test
    void approvedSiteReviewsAreMergedIntoPublicList() {
        User u = author(9L, "Asha Learner");
        SiteReview sr = siteReview(300L, u, OffsetDateTime.now().minus(1, ChronoUnit.DAYS),
                "Mentorly is a wonderful platform for skill swaps.");
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(sr));
        when(bookingRepository.countByLearnerIdAndBookingStatus(9L, BookingStatus.COMPLETED)).thenReturn(3L);
        when(bookingRepository.countBySessionMentorIdAndBookingStatus(9L, BookingStatus.COMPLETED)).thenReturn(1L);

        List<ReviewDto> result = service.latestApprovedReviews(6);

        // Only APPROVED is ever requested from the repository.
        verify(siteReviewRepository).findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class));

        ReviewDto dto = result.stream()
                .filter(d -> Long.valueOf(300L).equals(d.getReviewId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("site review missing from public list"));

        assertEquals("Mentorly is a wonderful platform for skill swaps.", dto.getReviewText());
        assertEquals(5, dto.getRating());
        assertEquals("Asha Learner", dto.getReviewerName());
        assertEquals("LEARNER", dto.getReviewerRole());
        assertEquals("Mentorly platform", dto.getSkillExchanged());
        assertEquals(4L, dto.getCompletedSwaps());
    }

    @Test
    void siteReviewsAreSortedWithOthersNewestFirst() {
        User u = author(9L, "Asha Learner");
        SiteReview older = siteReview(301L, u, OffsetDateTime.now().minus(5, ChronoUnit.DAYS),
                "An older approved comment about the platform.");
        SiteReview newer = siteReview(302L, u, OffsetDateTime.now(),
                "A fresh approved comment about the platform.");
        // JPQL orders by createdAt DESC; the service must preserve that ordering.
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(newer, older));

        List<ReviewDto> result = service.latestApprovedReviews(6);

        assertEquals(2, result.size());
        assertEquals(Long.valueOf(302L), result.get(0).getReviewId());
        assertEquals(Long.valueOf(301L), result.get(1).getReviewId());
        assertTrue(result.get(0).getReviewDate().isAfter(result.get(1).getReviewDate()));
    }
}
