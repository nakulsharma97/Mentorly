package com.mentorly.review;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.notification.NotificationService;
import com.mentorly.payment.PaymentStatus;
import com.mentorly.review.ReviewDtos.ReviewSummaryResponse;
import com.mentorly.session.SessionRepository;
import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regression tests for the review cache/metrics defects found in the audit:
 *
 * <ol>
 *   <li>{@code createLearnerReview} carried {@code @CacheEvict(key = "#mentorId")}
 *       on a method with no {@code mentorId} parameter — SpEL resolved null and
 *       every submission died with {@code IllegalArgumentException: Null key
 *       returned for cache operation} (surfaced as HTTP 400).</li>
 *   <li>{@code mentorReviews} is read under key {@code "mentorId:page:size"}
 *       but was evicted under a bare Long key, so new reviews/replies never
 *       appeared in a mentor's cached summary.</li>
 *   <li>{@code getLearnerReviews} hard-coded a 100% recommendation rate and
 *       put the total into the five-star slot.</li>
 *   <li>Eligibility lookups issued one {@code existsByBookingId} per booking;
 *       they now use a single {@code IN (...)} query (correctness asserted here).</li>
 * </ol>
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:review-regression-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.auth.cookies.secure=false",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545"
})
@Transactional
@Rollback
class ReviewServiceRegressionTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    /** Keeps notification rows out of the way — this suite is about reviews. */
    @MockBean
    private NotificationService notificationService;

    @Autowired
    private ReviewService reviewService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private MentorReviewRepository mentorReviewRepository;

    @Autowired
    private LearnerReviewRepository learnerReviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User mentor;
    private User learner;
    private User secondLearner;

    @BeforeEach
    void setUp() {
        mentor = createUser("rvmentor", UserRole.MENTOR);
        learner = createUser("rvlearner", UserRole.LEARNER);
        secondLearner = createUser("rvlearner2", UserRole.LEARNER);
    }

    // ── Bug 1: submission must not die on a null cache key ─────────────

    @Test
    void learnerReviewSubmissionSucceeds() {
        Booking booking = newCompletedBooking(learner, "Debugging async JS", null);

        LearnerReview saved = reviewService.createLearnerReview(
                mentor, booking.getId(), learner.getId(), 4,
                "Clear explanations and a useful homework task.");

        assertNotNull(saved.getId(), "learner review must be persisted");
        assertTrue(learnerReviewRepository.existsByBookingId(booking.getId()));
    }

    // ── Bug 2: a new review must invalidate the cached mentor summary ──

    @Test
    void newMentorReviewInvalidatesTheCachedSummary() {
        Booking first = newCompletedBooking(learner, "React fundamentals", null);
        reviewService.createMentorReview(learner, first.getId(), mentor.getId(), 5,
                "Fantastic mentor, would book again.");

        // Prime the mentorReviews cache with a one-review summary.
        ReviewSummaryResponse before = reviewService.getMentorReviews(mentor.getId(), 0, 20);
        assertEquals(1, before.totalReviews());

        Booking second = newCompletedBooking(secondLearner, "State management deep dive", null);
        reviewService.createMentorReview(secondLearner, second.getId(), mentor.getId(), 5,
                "Answered every question patiently.");

        ReviewSummaryResponse after = reviewService.getMentorReviews(mentor.getId(), 0, 20);
        assertEquals(2, after.totalReviews(),
                "creating a review must evict the cached summary, otherwise the "
                        + "dashboard keeps showing the old totals");
        assertEquals(2, after.reviews().size());

        // Same guarantee for the reply path.
        Long reviewId = after.reviews().get(0).id();
        reviewService.replyToReview(mentor, reviewId, "Thank you!");
        ReviewSummaryResponse afterReply = reviewService.getMentorReviews(mentor.getId(), 0, 20);
        assertEquals("Thank you!", afterReply.reviews().get(0).replyText(),
                "a reply must be visible immediately, not only after a TTL");
    }

    // ── Bug 3: learner-review metrics must be computed, not hard-coded ─

    @Test
    void learnerSummaryReportsRealMetrics() {
        createLearnerReviewForNewBooking(learner, 5, "Excellent session overall.");
        createLearnerReviewForNewBooking(learner, 5, "Very well prepared mentor.");
        createLearnerReviewForNewBooking(learner, 3, "Useful but ran over time.");

        ReviewSummaryResponse summary = reviewService.getLearnerReviews(learner.getId());

        assertEquals(3, summary.totalReviews());
        assertEquals(2, summary.fiveStarReviews(), "five-star slot must hold the five-star count");
        assertEquals(67, summary.recommendationRate(),
                "2 of 3 ratings are 4★+ → 67%, not a flat 100%");
        assertEquals(4.3, summary.averageRating(), 0.05);
        assertEquals(2L, summary.distribution().get(5));
        assertEquals(0L, summary.distribution().get(4));
        assertEquals(1L, summary.distribution().get(3));
        assertEquals(0L, summary.distribution().get(1));
    }

    // ── Bug 4: eligibility must skip already-reviewed bookings ─────────

    @Test
    void eligibilityListsSkipAlreadyReviewedBookings() {
        Booking reviewed = newCompletedBooking(learner, "Reviewed session", PaymentStatus.RELEASED);
        Booking open = newCompletedBooking(learner, "Unreviewed session", PaymentStatus.RELEASED);
        reviewService.createMentorReview(learner, reviewed.getId(), mentor.getId(), 5,
                "Great session, fully recommended.");

        List<ReviewDtos.EligibleBookingResponse> forMentor =
                reviewService.getEligibleBookingsForMentorReview(learner, mentor.getId());
        assertEquals(1, forMentor.size());
        assertEquals(open.getId(), forMentor.get(0).bookingId());
        assertFalse(forMentor.stream().anyMatch(b -> b.bookingId().equals(reviewed.getId())));

        // Learner side: same rule, driven by the batched learner-review lookup.
        Booking learnerReviewed = newCompletedBooking(secondLearner, "Mentor-side reviewed", PaymentStatus.RELEASED);
        Booking learnerOpen = newCompletedBooking(secondLearner, "Mentor-side open", PaymentStatus.RELEASED);
        reviewService.createLearnerReview(mentor, learnerReviewed.getId(), secondLearner.getId(), 4,
                "Good participation in the session.");

        List<ReviewDtos.EligibleBookingResponse> forLearner =
                reviewService.getEligibleBookingsForLearnerReview(mentor, secondLearner.getId());
        assertEquals(1, forLearner.size());
        assertEquals(learnerOpen.getId(), forLearner.get(0).bookingId());
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private void createLearnerReviewForNewBooking(User forLearner, int rating, String comment) {
        Booking booking = newCompletedBooking(forLearner, "Session " + UUID.randomUUID(), null);
        reviewService.createLearnerReview(mentor, booking.getId(), forLearner.getId(), rating, comment);
    }

    private Booking newCompletedBooking(User forLearner, String sessionTitle, PaymentStatus paymentStatus) {
        SkillSession session = new SkillSession();
        session.setMentor(mentor);
        session.setTitle(sessionTitle);
        session.setStartTime(OffsetDateTime.now().minusHours(3));
        session.setEndTime(OffsetDateTime.now().minusHours(2));
        session.setPriceAmount(new BigDecimal("0.00"));
        session = sessionRepository.save(session);

        Booking booking = new Booking();
        booking.setSession(session);
        booking.setLearner(forLearner);
        booking.setBookingStatus(BookingStatus.COMPLETED);
        if (paymentStatus != null) {
            booking.setPaymentStatus(paymentStatus);
        }
        return bookingRepository.save(booking);
    }

    private User createUser(String prefix, UserRole role) {
        User user = new User();
        user.setEmail(prefix + "+" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(prefix + UUID.randomUUID().toString().substring(0, 6));
        user.setFullName(role.name() + " User " + UUID.randomUUID().toString().substring(0, 8));
        user.setEnabled(true);
        user.setProfileCompleted(true);
        return userRepository.save(user);
    }
}
