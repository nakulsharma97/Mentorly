package com.mentorly.stats;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.sitereview.SiteReview;
import com.mentorly.sitereview.SiteReviewRepository;
import com.mentorly.sitereview.SiteReviewStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * Verifies the public testimonials list contains ONLY approved site reviews
 * ("Share your review"). Mentor→learner and learner→mentor reviews must never
 * reach the landing page, and the completed-swap counts must come from ONE
 * grouped query — never one query per row (the endpoint runs in a 512 MB
 * container).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestimonialsServiceSiteReviewTest {

    @Mock
    private SiteReviewRepository siteReviewRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private CacheManager cacheManager;

    @InjectMocks
    private TestimonialsService service;

    @BeforeEach
    void setUp() {
        when(bookingRepository.countCompletedSessionsByUserIdsIn(anyCollection(), anyString()))
                .thenReturn(List.of());
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
    void onlyApprovedSiteReviewsAreReturned() {
        User u = author(9L, "Asha Learner");
        SiteReview sr = siteReview(300L, u, OffsetDateTime.now().minus(1, ChronoUnit.DAYS),
                "Mentorly is a wonderful platform for skill swaps.");
        // The repository only ever receives APPROVED — PENDING/REJECTED rows
        // are never fetched, so they can never be shown.
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(sr));
        when(bookingRepository.countCompletedSessionsByUserIdsIn(anyCollection(), eq("COMPLETED")))
                .thenReturn(List.<Object[]>of(new Object[] { 9L, 4L }));

        List<ReviewDto> result = service.latestApprovedReviews(6);

        verify(siteReviewRepository).findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class));
        verifyNoMoreInteractions(siteReviewRepository);

        ReviewDto dto = result.get(0);
        assertEquals("Mentorly is a wonderful platform for skill swaps.", dto.getReviewText());
        assertEquals(5, dto.getRating());
        assertEquals("Asha Learner", dto.getReviewerName());
        assertEquals("LEARNER", dto.getReviewerRole());
        assertEquals("Mentorly platform", dto.getSkillExchanged());
        assertEquals(4L, dto.getCompletedSwaps());
        assertEquals("SITE", dto.getSource());
    }

    @Test
    void mentorAndLearnerReviewSourcesNeverAppear() {
        // Three approved site reviews — the ONLY kind of row allowed on the
        // landing page. MentorReview/LearnerReview rows must never be merged in.
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(
                        siteReview(301L, author(1L, "A"), OffsetDateTime.now(), "First platform review."),
                        siteReview(302L, author(2L, "B"), OffsetDateTime.now(), "Second platform review."),
                        siteReview(303L, author(3L, "C"), OffsetDateTime.now(), "Third platform review.")));

        List<ReviewDto> result = service.latestApprovedReviews(6);

        assertEquals(3, result.size());
        assertTrue(result.stream().allMatch(d -> "SITE".equals(d.getSource())),
                "only site reviews may appear on the landing page");
        assertTrue(result.stream().noneMatch(d -> "MENTOR_REVIEW".equals(d.getSource())
                        || "LEARNER_REVIEW".equals(d.getSource())),
                "mentor/learner reviews must never appear in public testimonials");
    }

    @Test
    void newestFirstOrderIsPreserved() {
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

    @Test
    void limitIsRespectedAndPassedToTheRepository() {
        int limit = 2;
        List<SiteReview> rows = new ArrayList<>();
        rows.add(siteReview(401L, author(1L, "A"), OffsetDateTime.now().minusSeconds(10), "One approved comment here."));
        rows.add(siteReview(402L, author(2L, "B"), OffsetDateTime.now().minusSeconds(5), "Two approved comment here."));
        rows.add(siteReview(403L, author(3L, "C"), OffsetDateTime.now(), "Three approved comment here."));
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(rows);

        List<ReviewDto> result = service.latestApprovedReviews(limit);

        verify(siteReviewRepository).findByStatusWithUser(
                eq(SiteReviewStatus.APPROVED), eq(PageRequest.of(0, limit)));
        assertTrue(result.size() <= limit, "result must never exceed the requested limit");
        assertEquals(2, result.size());
        assertEquals(Long.valueOf(403L), result.get(0).getReviewId(), "newest row comes first");
    }

    @Test
    void zeroLimitReturnsEmptyWithoutTouchingTheDatabase() {
        assertTrue(service.latestApprovedReviews(0).isEmpty());
        verify(siteReviewRepository, never()).findByStatusWithUser(any(), any());
        verify(bookingRepository, never()).countCompletedSessionsByUserIdsIn(anyCollection(), anyString());
    }

    @Test
    void completedCountsUseExactlyOneGroupedQuery() {
        List<SiteReview> rows = List.of(
                siteReview(501L, author(1L, "Learner A"), OffsetDateTime.now().minusSeconds(10), "Review one by learner."),
                siteReview(502L, author(2L, "Mentor B"), OffsetDateTime.now().minusSeconds(20), "Review two by mentor."),
                siteReview(503L, author(3L, "Learner C"), OffsetDateTime.now().minusSeconds(30), "Review three by learner."));
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(rows);
        // One grouped [id, count] result for the whole page — learner-side and
        // mentor-side totals already summed by the repository query.
        when(bookingRepository.countCompletedSessionsByUserIdsIn(anyCollection(), eq("COMPLETED")))
                .thenReturn(List.<Object[]>of(new Object[] { 1L, 3L }, new Object[] { 2L, 5L }));

        List<ReviewDto> result = service.latestApprovedReviews(6);

        // ONE grouped call for all three authors …
        verify(bookingRepository, times(1))
                .countCompletedSessionsByUserIdsIn(anyCollection(), eq("COMPLETED"));
        // … and never the old per-review count queries.
        verify(bookingRepository, never()).countByLearnerIdAndBookingStatus(any(Long.class), any(BookingStatus.class));
        verify(bookingRepository, never()).countBySessionMentorIdAndBookingStatus(any(Long.class), any(BookingStatus.class));

        assertEquals(3L, result.get(0).getCompletedSwaps()); // author 1
        assertEquals(5L, result.get(1).getCompletedSwaps()); // author 2
        assertEquals(0L, result.get(2).getCompletedSwaps()); // author 3 — no row
    }

    @Test
    void groupQueryReceivesEveryDistinctAuthorIdOnce() {
        List<SiteReview> rows = List.of(
                siteReview(601L, author(7L, "Same Author"), OffsetDateTime.now().minusSeconds(20), "First review by same author."),
                siteReview(602L, author(7L, "Same Author"), OffsetDateTime.now().minusSeconds(10), "Second review by same author."),
                siteReview(603L, author(8L, "Another Author"), OffsetDateTime.now(), "Review by another author."));
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(rows);

        service.latestApprovedReviews(6);

        verify(bookingRepository).countCompletedSessionsByUserIdsIn(
                eq(java.util.List.of(7L, 8L)), eq("COMPLETED"));
    }
}
