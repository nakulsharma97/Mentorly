package com.mentorly.stats;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.notification.EmailNotificationService;
import com.mentorly.sitereview.SiteReview;
import com.mentorly.sitereview.SiteReviewRepository;
import com.mentorly.sitereview.SiteReviewService;
import com.mentorly.sitereview.SiteReviewStatus;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * URL-level behaviour of the public testimonials feed behind
 * {@code GET /api/v1/public/testimonials}:
 * <ul>
 *   <li>anonymous callers can read it (landing page),</li>
 *   <li>only admin-approved <b>site</b> reviews are served — never mentor/learner
 *       review rows, never pending/rejected ones,</li>
 *   <li>an approval shows up on the very next request (the cache is evicted on
 *       moderation, so there is no "waiting for the cache" window).</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:testimonials-public-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class TestimonialsControllerIntegrationTest {

    private static final String ENDPOINT = "/api/v1/public/testimonials";

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @MockBean
    private ProfileCompletionGuard profileCompletionGuard;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SiteReviewRepository siteReviewRepository;

    @Autowired
    private SiteReviewService siteReviewService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CacheManager cacheManager;

    private User admin;
    private User learner;
    private User secondLearner;

    @BeforeEach
    void setUp() {
        admin = createUser("tpladmin", UserRole.ADMIN);
        learner = createUser("tpllearner", UserRole.LEARNER);
        secondLearner = createUser("tpllearner2", UserRole.LEARNER);
        // Each test starts from an empty testimonials cache so a list cached by
        // a previous test can never leak into this one.
        var cache = cacheManager.getCache(TestimonialsService.TESTIMONIALS_CACHE);
        if (cache != null) {
            cache.clear();
        }
    }

    @Test
    void anonymousCallerSeesOnlyApprovedSiteReviews() throws Exception {
        saveReview(learner, SiteReviewStatus.APPROVED,
                "Mentorly made it easy to find a great mentor.", 10);
        saveReview(secondLearner, SiteReviewStatus.PENDING,
                "This one is still waiting for moderation.", 5);
        saveReview(secondLearner, SiteReviewStatus.REJECTED,
                "This one was rejected by an admin outright.", 1);

        mockMvc.perform(get(ENDPOINT).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].source").value("SITE"))
                .andExpect(jsonPath("$[0].reviewText")
                        .value("Mentorly made it easy to find a great mentor."));
    }

    @Test
    void approvedReviewIsVisibleOnTheVeryNextRequest() throws Exception {
        SiteReview approved = saveReview(learner, SiteReviewStatus.APPROVED,
                "Already approved platform review content.", 20);

        // First request populates the cache with one row.
        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        SiteReview pending = saveReview(secondLearner, SiteReviewStatus.PENDING,
                "Freshly moderated platform review content.", 5);
        // Still hidden while pending — and the cached list must not show it either.
        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Admin approval must evict the cache: no waiting for a TTL.
        siteReviewService.adminApprove(admin, pending.getId(), "Approved for test");

        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].reviewId").value(pending.getId()))
                .andExpect(jsonPath("$[1].reviewId").value(approved.getId()));
    }

    @Test
    void deletingAReviewRemovesItFromThePublicFeed() throws Exception {
        SiteReview only = saveReview(learner, SiteReviewStatus.APPROVED,
                "The single approved platform review here.", 30);

        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        siteReviewService.delete(learner);

        mockMvc.perform(get(ENDPOINT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        org.junit.jupiter.api.Assertions.assertFalse(
                siteReviewRepository.findById(only.getId()).isPresent());
    }

    // ── Helpers ────────────────────────────────────────────────

    private SiteReview saveReview(User author, SiteReviewStatus status, String comment, int minutesAgo) {
        SiteReview review = new SiteReview();
        review.setUser(author);
        review.setRating(5);
        review.setTitle("Platform review");
        review.setComment(comment);
        review.setStatus(status);
        review.setCreatedAt(OffsetDateTime.now().minusMinutes(minutesAgo));
        return siteReviewRepository.saveAndFlush(review);
    }

    private User createUser(String prefix, UserRole role) {
        User user = new User();
        user.setEmail(prefix + "+" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(prefix + UUID.randomUUID().toString().substring(0, 6));
        user.setFullName(role.name() + " User " + UUID.randomUUID().toString().substring(0, 8));
        user.setEnabled(true);
        return userRepository.save(user);
    }
}
