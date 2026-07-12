package com.skillswap.booking;

import com.skillswap.certification.CertificationService;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.notification.NotificationService;
import com.skillswap.payment.PaymentRepository;
import com.skillswap.roadmap.LearningRoadmapRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.waitlist.SessionWaitlistRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.skillswap.wallet.WalletService;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.booking.BookingLifecycleService;
import com.skillswap.referral.ReferralService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.test.web.servlet.result.MockMvcResultHandlers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BookingController.class)
@AutoConfigureMockMvc(addFilters = false)
class BookingControllerIntegrationTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private BookingRepository bookingRepository;
        @MockitoBean
        private WalletService walletService;
        @MockitoBean
        private EmailNotificationService emailService;
        @MockitoBean
        private BookingLifecycleService bookingLifecycleService;
        @MockitoBean
        private ReferralService referralService;
        @MockitoBean
        private SessionRepository sessionRepository;
        @MockitoBean
        private LearningRoadmapRepository learningRoadmapRepository;
        @MockitoBean
        private PaymentRepository paymentRepository;
        @MockitoBean
        private NotificationService notificationService;
        @MockitoBean
        private CertificationService certificationService;
        @MockitoBean
        private SessionWaitlistRepository sessionWaitlistRepository;
        @MockitoBean
        private BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;
        @MockitoBean
        private MeterRegistry meterRegistry;

        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @MockitoBean
        private EndpointRateLimitFilter endpointRateLimitFilter;

        @MockitoBean
        private RequestTraceFilter requestTraceFilter;

        @MockitoBean
        private UserDetailsService userDetailsService;

        @MockitoBean
        private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

        @MockitoBean
        private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

        @Test
        void createBookingRejectsMentorCaller() throws Exception {
                User mentorCaller = new User();
                mentorCaller.setId(10L);
                mentorCaller.setRole(UserRole.MENTOR);

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(mentorCaller, null,
                                mentorCaller.getAuthorities()));
                SecurityContextHolder.setContext(context);

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "booking-test-key-1")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 1}
                                                        """))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.message").value("Request failed"))
                                        .andExpect(jsonPath("$.data.error").value("Only learners can create bookings"));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void createBookingRejectsInvalidIdempotencyKeyFormat() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                                learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "bad key!")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 99}
                                                        """))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.data.error")
                                                        .value("Idempotency-Key header format is invalid (allowed: letters, numbers, . _ : -)"))
                                        .andExpect(jsonPath("$.data.retryable").value(false));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void createBookingRejectsIdempotencyKeyLengthOutsideRange() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                                learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "short")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 99}
                                                        """))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.data.error")
                                                        .value("Idempotency-Key header must be 8-120 characters"))
                                        .andExpect(jsonPath("$.data.retryable").value(false));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void createBookingReturnsSuccessForLearner() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);
                learner.setFullName("Learner One");

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                                learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                User mentor = new User();
                mentor.setId(20L);
                mentor.setRole(UserRole.MENTOR);

                SkillSession session = new SkillSession();
                session.setId(99L);
                session.setMentor(mentor);
                session.setTitle("Java Intro");
                session.setMaxParticipants(2);
                session.setStartTime(OffsetDateTime.now().plusDays(1));
                session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
                session.setPriceAmount(new BigDecimal("15.00"));

                Booking booking = new Booking();
                booking.setId(123L);
                booking.setSession(session);
                booking.setLearner(learner);
                booking.setBookingStatus(BookingStatus.PENDING);

                when(sessionRepository.findById(99L)).thenReturn(Optional.of(session));
                when(bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(99L, 11L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED,
                                                BookingStatus.COMPLETED)))
                                .thenReturn(false);
                when(bookingRepository.countBySessionIdAndBookingStatusIn(99L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED)))
                                .thenReturn(0L);
                when(bookingRepository.save(any(Booking.class))).thenReturn(booking);
                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                                anyString()))
                                .thenReturn(Optional.empty());

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "booking-test-key-2")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 99}
                                                        """))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.message").value("Booking created"))
                                        .andExpect(jsonPath("$.data.id").value(123));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void createBookingReturnsRetryableConflictOnTransientWriteConflict() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);
                learner.setFullName("Learner One");

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                                learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                User mentor = new User();
                mentor.setId(20L);
                mentor.setRole(UserRole.MENTOR);

                SkillSession session = new SkillSession();
                session.setId(99L);
                session.setMentor(mentor);
                session.setTitle("Java Intro");
                session.setMaxParticipants(2);
                session.setStartTime(OffsetDateTime.now().plusDays(1));
                session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
                session.setPriceAmount(new BigDecimal("15.00"));

                when(sessionRepository.findById(99L)).thenReturn(Optional.of(session));
                when(bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(99L, 11L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED,
                                                BookingStatus.COMPLETED)))
                                .thenReturn(false);
                when(bookingRepository.countBySessionIdAndBookingStatusIn(99L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED)))
                                .thenReturn(0L);
                when(bookingRepository.save(any(Booking.class)))
                                .thenThrow(new DataIntegrityViolationException("simulated transient conflict"));
                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                                anyString()))
                                .thenReturn(Optional.empty());

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "booking-test-conflict")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 99}
                                                        """))
                                        .andExpect(status().isConflict())
                                        .andExpect(jsonPath("$.data.code").value("BOOKING_TEMPORARY_CONFLICT"))
                                        .andExpect(jsonPath("$.data.error")
                                                        .value("Temporary booking conflict. Please retry."))
                                        .andExpect(jsonPath("$.data.retryable").value(true));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void createBookingReplaysByIdempotencyKey() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                                learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                Booking existingBooking = new Booking();
                existingBooking.setId(456L);
                existingBooking.setBookingStatus(BookingStatus.PENDING);

                BookingIdempotencyKey key = new BookingIdempotencyKey();
                key.setRequestHash("99");
                key.setBooking(existingBooking);

                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                                anyString()))
                                .thenReturn(Optional.of(key));

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "booking-test-replay")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 99}
                                                        """))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.message").value("Booking replayed"))
                                        .andExpect(jsonPath("$.data.id").value(456));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void createBookingRejectsIdempotencyPayloadMismatch() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(learner, null,
                                learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                BookingIdempotencyKey key = new BookingIdempotencyKey();
                key.setRequestHash("101");

                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(anyLong(), anyString(),
                                anyString()))
                                .thenReturn(Optional.of(key));

                try {
                        mockMvc.perform(post("/api/v1/bookings")
                                        .header("Idempotency-Key", "booking-test-mismatch")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"sessionId": 99}
                                                        """))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.data.error")
                                                        .value("Idempotency key reuse with different payload"))
                                        .andExpect(jsonPath("$.data.retryable").value(false));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void updateStatusRejectsCompletedTransitionByLearner() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                User mentor = new User();
                mentor.setId(20L);
                mentor.setRole(UserRole.MENTOR);

                Booking booking = buildBooking(
                                700L,
                                learner,
                                mentor,
                                BookingStatus.IN_PROGRESS);
                when(bookingRepository.findById(700L)).thenReturn(Optional.of(booking));
                when(bookingLifecycleService.completeBooking(
                                anyLong(),
                                any(User.class)))
                                .thenThrow(new IllegalArgumentException(
                                                "Only mentor can complete a booking"));

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(
                                new UsernamePasswordAuthenticationToken(learner, null, learner.getAuthorities()));
                SecurityContextHolder.setContext(context);

                try {
                        mockMvc.perform(patch("/api/v1/bookings/700/status")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"status":"COMPLETED"}
                                                        """))
                                        .andDo(result -> {
                                                System.out.println("EXCEPTION = "
                                                                + result.getResolvedException());

                                                if (result.getResolvedException() != null) {
                                                        result.getResolvedException().printStackTrace();
                                                }
                                        })
                                        .andDo(MockMvcResultHandlers.print())
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.data.error")
                                                        .value("Only mentor can complete a booking"));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void updateStatusAllowsCompletedTransitionByMentor() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                User mentor = new User();
                mentor.setId(20L);
                mentor.setRole(UserRole.MENTOR);

                Booking booking = buildBooking(
                                701L,
                                learner,
                                mentor,
                                BookingStatus.IN_PROGRESS);

                Booking completedBooking = buildBooking(
                                701L,
                                learner,
                                mentor,
                                BookingStatus.COMPLETED);

                when(bookingRepository.findById(701L))
                                .thenReturn(Optional.of(booking));

                when(bookingLifecycleService.completeBooking(
                                anyLong(),
                                any(User.class)))
                                .thenReturn(completedBooking);

                when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(
                                new UsernamePasswordAuthenticationToken(mentor, null, mentor.getAuthorities()));
                SecurityContextHolder.setContext(context);

                try {
                        mockMvc.perform(patch("/api/v1/bookings/701/status")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("""
                                                        {"status":"COMPLETED"}
                                                        """))
                                        .andDo(MockMvcResultHandlers.print())
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.message").value("Booking completed"))
                                        .andExpect(jsonPath("$.data.bookingStatus").value("COMPLETED"));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        @Test
        void updateStatusAllowsTransitionByAdmin() throws Exception {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                User mentor = new User();
                mentor.setId(20L);
                mentor.setRole(UserRole.MENTOR);

                User admin = new User();
                admin.setId(1L);
                admin.setRole(UserRole.ADMIN);

                Booking booking = buildBooking(
                                702L,
                                learner,
                                mentor,
                                BookingStatus.ACCEPTED);

                Booking cancelledBooking = buildBooking(
                                702L,
                                learner,
                                mentor,
                                BookingStatus.CANCELLED);

                when(bookingRepository.findById(702L))
                                .thenReturn(Optional.of(booking));

                when(bookingLifecycleService.cancelBooking(
                                anyLong(),
                                any(User.class)))
                                .thenReturn(cancelledBooking);

                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
                SecurityContextHolder.setContext(context);

                try {
                        mockMvc.perform(
                                        patch("/api/v1/bookings/702/status")
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content("""
                                                                        {"status":"CANCELLED"}
                                                                        """))
                                        .andDo(result -> {
                                                System.out.println("EXCEPTION = " + result.getResolvedException());

                                                if (result.getResolvedException() != null) {
                                                        result.getResolvedException().printStackTrace();
                                                }
                                        })
                                        .andDo(MockMvcResultHandlers.print())
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.data.bookingStatus").value("CANCELLED"));
                } finally {
                        SecurityContextHolder.clearContext();
                }
        }

        private static Booking buildBooking(Long bookingId, User learner, User mentor, BookingStatus status) {
                SkillSession session = new SkillSession();
                session.setId(501L);
                session.setMentor(mentor);
                session.setTitle("Advanced Java");
                session.setStartTime(OffsetDateTime.now().minusHours(2));
                session.setEndTime(OffsetDateTime.now().minusHours(1));
                session.setCancellationWindowHours(24);
                session.setRescheduleWindowHours(12);

                Booking booking = new Booking();
                booking.setId(bookingId);
                booking.setLearner(learner);
                booking.setSession(session);
                booking.setBookingStatus(status);
                return booking;
        }
}
