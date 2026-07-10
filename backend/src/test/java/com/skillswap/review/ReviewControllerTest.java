package com.skillswap.review;

import com.skillswap.auth.JwtService;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.notification.NotificationService;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReviewController.class)
@AutoConfigureMockMvc(addFilters = false)
class ReviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MentorReviewRepository mentorReviewRepository;

    @MockitoBean
    private LearnerReviewRepository learnerReviewRepository;

    @MockitoBean
    private BookingRepository bookingRepository;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private NotificationService notificationService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Test
    void mentorReviewSummaryEndpointReturnsDistributionAndReplyData() throws Exception {
        User mentor = new User();
        mentor.setId(10L);
        mentor.setFullName("Mentor Maya");

        User learner = new User();
        learner.setId(20L);
        learner.setFullName("Ada");

        SkillSession session = new SkillSession();
        session.setTitle("System design prep");

        Booking booking = new Booking();
        booking.setId(30L);
        booking.setSession(session);
        booking.setLearner(learner);

        MentorReview review = new MentorReview();
        review.setId(77L);
        review.setMentor(mentor);
        review.setLearner(learner);
        review.setBooking(booking);
        review.setRating(5);
        review.setComment("Fantastic session");
        review.setReplyText("Thanks for the feedback");
        review.setCreatedAt(OffsetDateTime.parse("2026-01-01T10:15:30Z"));

        given(mentorReviewRepository.findByMentorIdOrderByCreatedAtDesc(10L)).willReturn(List.of(review));
        given(mentorReviewRepository.averageRatingByMentorId(10L)).willReturn(Optional.of(5.0));
        given(mentorReviewRepository.countByMentorId(10L)).willReturn(1L);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(get("/api/v1/reviews/mentor")
                    .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Mentor reviews fetched"))
                    .andExpect(jsonPath("$.data.averageRating").value(5.0))
                    .andExpect(jsonPath("$.data.totalReviews").value(1))
                    .andExpect(jsonPath("$.data.recommendationRate").value(100))
                    .andExpect(jsonPath("$.data.distribution.5").value(1))
                    .andExpect(jsonPath("$.data.reviews[0].replyText").value("Thanks for the feedback"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
