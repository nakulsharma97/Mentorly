package com.skillswap.booking;

import com.skillswap.certification.CertificationService;
import com.skillswap.common.ApiClientException;
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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingControllerServiceTest {

        @Mock
        private BookingRepository bookingRepository;
        @Mock
        private SessionRepository sessionRepository;
        @Mock
        private LearningRoadmapRepository learningRoadmapRepository;
        @Mock
        private PaymentRepository paymentRepository;
        @Mock
        private NotificationService notificationService;
        @Mock
        private CertificationService certificationService;
        @Mock
        private SessionWaitlistRepository sessionWaitlistRepository;
        @Mock
        private BookingIdempotencyKeyRepository bookingIdempotencyKeyRepository;
        @Mock
        private MeterRegistry meterRegistry;

        @InjectMocks
        private BookingController bookingController;

        @Test
        void createRejectsNonLearnerRole() {
                User mentor = new User();
                mentor.setId(2L);
                mentor.setRole(UserRole.MENTOR);

                IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                                () -> bookingController.create(mentor, "booking-key-1",
                                                new BookingController.BookingRequest(10L)));

                assertEquals("Only learners can create bookings", ex.getMessage());
        }

        @Test
        void createRejectsIdempotencyKeyLengthOutsideRange() {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                                () -> bookingController.create(learner, "short",
                                                new BookingController.BookingRequest(10L)));

                assertEquals("Idempotency-Key header must be 8-120 characters", ex.getMessage());
        }

        @Test
        void createRejectsIdempotencyKeyInvalidFormat() {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                                () -> bookingController.create(learner, "bad key!",
                                                new BookingController.BookingRequest(10L)));

                assertEquals("Idempotency-Key header format is invalid (allowed: letters, numbers, . _ : -)",
                                ex.getMessage());
        }

        @Test
        void createSavesBookingForLearnerWhenSessionHasCapacity() {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);
                learner.setFullName("Learner One");

                User mentor = new User();
                mentor.setId(22L);
                mentor.setRole(UserRole.MENTOR);

                SkillSession session = new SkillSession();
                session.setId(33L);
                session.setMentor(mentor);
                session.setTitle("Java Basics");
                session.setMaxParticipants(3);
                session.setStartTime(OffsetDateTime.now().plusDays(1));
                session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
                session.setPriceAmount(new BigDecimal("20.00"));

                Booking savedBooking = new Booking();
                savedBooking.setId(77L);
                savedBooking.setSession(session);
                savedBooking.setLearner(learner);
                savedBooking.setBookingStatus(BookingStatus.PENDING);

                when(sessionRepository.findById(33L)).thenReturn(Optional.of(session));
                when(bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(33L, 11L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED,
                                                BookingStatus.COMPLETED)))
                                .thenReturn(false);
                when(bookingRepository.countBySessionIdAndBookingStatusIn(33L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED)))
                                .thenReturn(0L);
                when(bookingRepository.save(any(Booking.class))).thenReturn(savedBooking);
                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(11L, "bookings.create",
                                "booking-key-2"))
                                .thenReturn(Optional.empty());

                var response = bookingController.create(learner, "booking-key-2",
                                new BookingController.BookingRequest(33L));

                assertEquals("Booking created", response.message());
                assertEquals(77L, response.data().getId());
                verify(learningRoadmapRepository).save(any());
                verify(notificationService).notifyUser(any(), any(), any(), any(), any());
                verify(bookingIdempotencyKeyRepository).save(any());
        }

        @Test
        void createReplaysByIdempotencyKey() {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);

                Booking existing = new Booking();
                existing.setId(901L);

                BookingIdempotencyKey key = new BookingIdempotencyKey();
                key.setRequestHash("33");
                key.setBooking(existing);

                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(11L, "bookings.create",
                                "booking-replay-key"))
                                .thenReturn(Optional.of(key));

                var response = bookingController.create(learner, "booking-replay-key",
                                new BookingController.BookingRequest(33L));

                assertEquals("Booking replayed", response.message());
                assertEquals(901L, response.data().getId());
                verify(bookingRepository, never()).save(any(Booking.class));
        }

        @Test
        void createThrowsRetryableConflictOnTransientWriteConflict() {
                User learner = new User();
                learner.setId(11L);
                learner.setRole(UserRole.LEARNER);
                learner.setFullName("Learner One");

                User mentor = new User();
                mentor.setId(22L);
                mentor.setRole(UserRole.MENTOR);

                SkillSession session = new SkillSession();
                session.setId(33L);
                session.setMentor(mentor);
                session.setTitle("Java Basics");
                session.setMaxParticipants(3);
                session.setStartTime(OffsetDateTime.now().plusDays(1));
                session.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
                session.setPriceAmount(new BigDecimal("20.00"));

                when(sessionRepository.findById(33L)).thenReturn(Optional.of(session));
                when(bookingRepository.existsBySessionIdAndLearnerIdAndBookingStatusIn(33L, 11L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED,
                                                BookingStatus.COMPLETED)))
                                .thenReturn(false);
                when(bookingRepository.countBySessionIdAndBookingStatusIn(33L,
                                List.of(BookingStatus.PENDING, BookingStatus.ACCEPTED,
                                                BookingStatus.RESCHEDULE_REQUESTED)))
                                .thenReturn(0L);
                when(bookingRepository.save(any(Booking.class)))
                                .thenThrow(new DataIntegrityViolationException("simulated transient conflict"));
                when(bookingIdempotencyKeyRepository.findByUserIdAndEndpointAndIdempotencyKey(11L, "bookings.create",
                                "booking-key-3"))
                                .thenReturn(Optional.empty());

                ApiClientException ex = assertThrows(ApiClientException.class,
                                () -> bookingController.create(learner, "booking-key-3",
                                                new BookingController.BookingRequest(33L)));

                assertEquals(HttpStatus.CONFLICT, ex.getStatus());
                assertEquals("BOOKING_TEMPORARY_CONFLICT", ex.getCode());
                assertEquals(true, ex.isRetryable());
        }

        @Test
        void updateStatusRejectsCompletionByLearner() {
                User learner = new User();
                learner.setId(1L);
                learner.setRole(UserRole.LEARNER);

                User mentor = new User();
                mentor.setId(2L);
                mentor.setRole(UserRole.MENTOR);

                SkillSession session = new SkillSession();
                session.setMentor(mentor);
                session.setTitle("Session");
                session.setStartTime(OffsetDateTime.now().plusDays(1));

                Booking booking = new Booking();
                booking.setId(9L);
                booking.setSession(session);
                booking.setLearner(learner);
                booking.setBookingStatus(BookingStatus.ACCEPTED);

                when(bookingRepository.findById(9L)).thenReturn(Optional.of(booking));

                IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                                () -> bookingController.updateStatus(learner, 9L,
                                                new BookingController.StatusUpdateRequest(BookingStatus.COMPLETED)));

                assertEquals("Only mentor can complete a booking", ex.getMessage());
        }
}
