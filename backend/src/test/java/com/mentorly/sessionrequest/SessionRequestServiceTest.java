package com.mentorly.sessionrequest;

import com.mentorly.booking.BookingRepository;
import com.mentorly.notification.NotificationService;
import com.mentorly.session.SessionRepository;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionRequestServiceTest {

    @Mock
    private SessionRequestRepository sessionRequestRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private SessionRequestService sessionRequestService;

    @Captor
    private ArgumentCaptor<SessionRequest> requestCaptor;

    private User learner;
    private User mentor;
    private SessionRequest pendingRequest;
    private SessionRequest acceptedRequest;
    private SessionRequest declinedRequest;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setFullName("Alice Learner");
        learner.setEmail("alice@test.com");
        learner.setRole(UserRole.LEARNER);

        mentor = new User();
        mentor.setId(2L);
        mentor.setFullName("Bob Mentor");
        mentor.setEmail("bob@test.com");
        mentor.setRole(UserRole.MENTOR);

        pendingRequest = new SessionRequest();
        pendingRequest.setId(100L);
        pendingRequest.setLearner(learner);
        pendingRequest.setMentor(mentor);
        pendingRequest.setMessage("I want to learn React");
        pendingRequest.setStatus(SessionRequestStatus.PENDING);
        pendingRequest.setCreatedAt(OffsetDateTime.now());
        pendingRequest.setUpdatedAt(OffsetDateTime.now());

        acceptedRequest = new SessionRequest();
        acceptedRequest.setId(101L);
        acceptedRequest.setLearner(learner);
        acceptedRequest.setMentor(mentor);
        acceptedRequest.setMessage("I want to learn Node.js");
        acceptedRequest.setStatus(SessionRequestStatus.ACCEPTED);
        acceptedRequest.setCreatedAt(OffsetDateTime.now());
        acceptedRequest.setUpdatedAt(OffsetDateTime.now());
        acceptedRequest.setResolvedAt(OffsetDateTime.now());

        declinedRequest = new SessionRequest();
        declinedRequest.setId(102L);
        declinedRequest.setLearner(learner);
        declinedRequest.setMentor(mentor);
        declinedRequest.setMessage("I want to learn Python");
        declinedRequest.setStatus(SessionRequestStatus.DECLINED);
        declinedRequest.setDeclineReason("Not teaching Python currently");
        declinedRequest.setCreatedAt(OffsetDateTime.now());
        declinedRequest.setUpdatedAt(OffsetDateTime.now());
        declinedRequest.setResolvedAt(OffsetDateTime.now());
    }

    // ═══════════════════════════════════════════════════════
    //  createRequest
    // ═══════════════════════════════════════════════════════

    @Test
    void createRequestSavesAndNotifiesMentor() {
        when(userRepository.findById(mentor.getId())).thenReturn(Optional.of(mentor));
        when(sessionRequestRepository.existsByLearnerIdAndMentorIdAndStatus(
                learner.getId(), mentor.getId(), SessionRequestStatus.PENDING)).thenReturn(false);
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> {
            SessionRequest req = inv.getArgument(0);
            req.setId(100L);
            return req;
        });

        SessionRequest result = sessionRequestService.createRequest(learner, mentor.getId(), "I want to learn React",
                null, null, null, null, null);

        assertNotNull(result);
        assertEquals(SessionRequestStatus.PENDING, result.getStatus());
        assertEquals("I want to learn React", result.getMessage());
        assertEquals(100L, result.getId());

        verify(notificationService).notifyUser(
                eq(mentor.getId()), eq("SESSION_REQUEST_RECEIVED"), anyString(),
                contains("requested a session"), eq(100L));
    }

    @Test
    void createRequestThrowsWhenLearnerRequestsSelf() {
        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.createRequest(learner, learner.getId(), "test",
                        null, null, null, null, null));
    }

    @Test
    void createRequestThrowsWhenUserIsNotMentor() {
        User anotherLearner = new User();
        anotherLearner.setId(3L);
        anotherLearner.setRole(UserRole.LEARNER);

        when(userRepository.findById(anotherLearner.getId())).thenReturn(Optional.of(anotherLearner));

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.createRequest(learner, anotherLearner.getId(), "test",
                        null, null, null, null, null));
    }

    @Test
    void createRequestThrowsWhenPendingDuplicateExists() {
        when(userRepository.findById(mentor.getId())).thenReturn(Optional.of(mentor));
        when(sessionRequestRepository.existsByLearnerIdAndMentorIdAndStatus(
                learner.getId(), mentor.getId(), SessionRequestStatus.PENDING)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.createRequest(learner, mentor.getId(), "duplicate",
                        null, null, null, null, null));
    }

    @Test
    void createRequestRejectsNonLearnerRole() {
        User admin = new User();
        admin.setId(99L);
        admin.setRole(UserRole.ADMIN);

        // ADMIN should be allowed
        when(userRepository.findById(mentor.getId())).thenReturn(Optional.of(mentor));
        when(sessionRequestRepository.existsByLearnerIdAndMentorIdAndStatus(
                admin.getId(), mentor.getId(), SessionRequestStatus.PENDING)).thenReturn(false);
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertDoesNotThrow(() -> sessionRequestService.createRequest(admin, mentor.getId(), "admin request",
                null, null, null, null, null));

        // MENTOR should be rejected
        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.createRequest(mentor, learner.getId(), "mentor trying",
                        null, null, null, null, null));
    }

    // ═══════════════════════════════════════════════════════
    //  acceptRequest
    // ═══════════════════════════════════════════════════════

    @Test
    void acceptRequestUpdatesStatusAndNotifiesLearner() {
        when(sessionRequestRepository.findByIdAndMentorId(pendingRequest.getId(), mentor.getId()))
                .thenReturn(Optional.of(pendingRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.acceptRequest(mentor, pendingRequest.getId(), "Looking forward!");

        assertEquals(SessionRequestStatus.ACCEPTED, result.getStatus());
        assertNotNull(result.getResolvedAt());

        verify(notificationService).notifyUser(
                eq(learner.getId()), eq("SESSION_REQUEST_ACCEPTED"), anyString(),
                contains("Looking forward!"), eq(pendingRequest.getId()));
    }

    @Test
    void acceptRequestWorksWithoutCustomMessage() {
        when(sessionRequestRepository.findByIdAndMentorId(pendingRequest.getId(), mentor.getId()))
                .thenReturn(Optional.of(pendingRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.acceptRequest(mentor, pendingRequest.getId(), null);

        assertEquals(SessionRequestStatus.ACCEPTED, result.getStatus());
        verify(notificationService).notifyUser(
                eq(learner.getId()), eq("SESSION_REQUEST_ACCEPTED"), anyString(),
                argThat(msg -> msg != null && !msg.contains("Message from mentor")), anyLong());
    }

    @Test
    void acceptRequestThrowsWhenAlreadyAccepted() {
        when(sessionRequestRepository.findByIdAndMentorId(acceptedRequest.getId(), mentor.getId()))
                .thenReturn(Optional.of(acceptedRequest));

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.acceptRequest(mentor, acceptedRequest.getId(), null));
    }

    @Test
    void acceptRequestThrowsWhenRequestNotFound() {
        when(sessionRequestRepository.findByIdAndMentorId(999L, mentor.getId()))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.acceptRequest(mentor, 999L, null));
    }

    // ═══════════════════════════════════════════════════════
    //  declineRequest
    // ═══════════════════════════════════════════════════════

    @Test
    void declineRequestUpdatesStatusWithReason() {
        when(sessionRequestRepository.findByIdAndMentorId(pendingRequest.getId(), mentor.getId()))
                .thenReturn(Optional.of(pendingRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.declineRequest(mentor, pendingRequest.getId(), "Too busy");

        assertEquals(SessionRequestStatus.DECLINED, result.getStatus());
        assertEquals("Too busy", result.getDeclineReason());
        assertNotNull(result.getResolvedAt());

        verify(notificationService).notifyUser(
                eq(learner.getId()), eq("SESSION_REQUEST_DECLINED"), anyString(),
                contains("Too busy"), eq(pendingRequest.getId()));
    }

    @Test
    void declineRequestWorksWithoutReason() {
        when(sessionRequestRepository.findByIdAndMentorId(pendingRequest.getId(), mentor.getId()))
                .thenReturn(Optional.of(pendingRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.declineRequest(mentor, pendingRequest.getId(), null);

        assertEquals(SessionRequestStatus.DECLINED, result.getStatus());
        assertNull(result.getDeclineReason());
    }

    @Test
    void declineRequestThrowsForNonPending() {
        when(sessionRequestRepository.findByIdAndMentorId(acceptedRequest.getId(), mentor.getId()))
                .thenReturn(Optional.of(acceptedRequest));

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.declineRequest(mentor, acceptedRequest.getId(), null));
    }

    // ═══════════════════════════════════════════════════════
    //  cancelRequest (learner)
    // ═══════════════════════════════════════════════════════

    @Test
    void cancelRequestByLearnerCancelsPendingRequest() {
        when(sessionRequestRepository.findByIdAndLearnerId(pendingRequest.getId(), learner.getId()))
                .thenReturn(Optional.of(pendingRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.cancelRequest(learner, pendingRequest.getId());

        assertEquals(SessionRequestStatus.DECLINED, result.getStatus());
        assertEquals("Cancelled by learner", result.getDeclineReason());

        verify(notificationService).notifyUser(
                eq(mentor.getId()), eq("SESSION_REQUEST_CANCELLED"), anyString(), anyString(), anyLong());
    }

    @Test
    void cancelRequestThrowsForNonPending() {
        when(sessionRequestRepository.findByIdAndLearnerId(acceptedRequest.getId(), learner.getId()))
                .thenReturn(Optional.of(acceptedRequest));

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.cancelRequest(learner, acceptedRequest.getId()));
    }

    @Test
    void cancelRequestThrowsWhenNotFound() {
        when(sessionRequestRepository.findByIdAndLearnerId(999L, learner.getId()))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.cancelRequest(learner, 999L));
    }

    // ═══════════════════════════════════════════════════════
    //  replyToRequest
    // ═══════════════════════════════════════════════════════

    @Test
    void replyToAcceptedRequestSavesReplyAndNotifiesMentor() {
        acceptedRequest.setId(200L);
        when(sessionRequestRepository.findByIdAndLearnerId(acceptedRequest.getId(), learner.getId()))
                .thenReturn(Optional.of(acceptedRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.replyToRequest(learner, acceptedRequest.getId(), "Thank you! I'm excited!");

        assertEquals("Thank you! I'm excited!", result.getReplyMessage());

        verify(notificationService).notifyUser(
                eq(mentor.getId()), eq("SESSION_REQUEST_REPLIED"), contains("acceptance"),
                contains("Thank you"), eq(acceptedRequest.getId()));
    }

    @Test
    void replyToDeclinedRequestWorks() {
        declinedRequest.setId(300L);
        when(sessionRequestRepository.findByIdAndLearnerId(declinedRequest.getId(), learner.getId()))
                .thenReturn(Optional.of(declinedRequest));
        when(sessionRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionRequest result = sessionRequestService.replyToRequest(learner, declinedRequest.getId(), "Maybe next time!");

        assertEquals("Maybe next time!", result.getReplyMessage());
        verify(notificationService).notifyUser(
                eq(mentor.getId()), eq("SESSION_REQUEST_REPLIED"), contains("decline"), anyString(), anyLong());
    }

    @Test
    void replyToPendingRequestThrows() {
        when(sessionRequestRepository.findByIdAndLearnerId(pendingRequest.getId(), learner.getId()))
                .thenReturn(Optional.of(pendingRequest));

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.replyToRequest(learner, pendingRequest.getId(), "reply"));
    }

    @Test
    void replyWithBlankMessageThrows() {
        when(sessionRequestRepository.findByIdAndLearnerId(acceptedRequest.getId(), learner.getId()))
                .thenReturn(Optional.of(acceptedRequest));

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.replyToRequest(learner, acceptedRequest.getId(), "   "));
    }

    @Test
    void replyToNonOwnedRequestThrows() {
        when(sessionRequestRepository.findByIdAndLearnerId(999L, learner.getId()))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> sessionRequestService.replyToRequest(learner, 999L, "reply"));
    }

    // ═══════════════════════════════════════════════════════
    //  listPendingForMentor (includes replied)
    // ═══════════════════════════════════════════════════════

    @Test
    void listPendingForMentorReturnsPendingAndReplied() {
        SessionRequest replied = new SessionRequest();
        replied.setId(500L);
        replied.setLearner(learner);
        replied.setMentor(mentor);
        replied.setStatus(SessionRequestStatus.DECLINED);
        replied.setReplyMessage("Thanks anyway");
        replied.setCreatedAt(OffsetDateTime.now());

        when(sessionRequestRepository.findByMentorIdAndStatusOrderByCreatedAtDesc(
                mentor.getId(), SessionRequestStatus.PENDING))
                .thenReturn(new ArrayList<>(List.of(pendingRequest)));
        when(sessionRequestRepository.findByMentorIdAndReplyMessageIsNotNull(mentor.getId()))
                .thenReturn(List.of(replied));

        List<SessionRequest> result = sessionRequestService.listPendingForMentor(mentor);

        assertEquals(2, result.size());
        assertTrue(result.stream().anyMatch(r -> r.getId().equals(pendingRequest.getId())));
        assertTrue(result.stream().anyMatch(r -> r.getId().equals(replied.getId())));
    }

    // ═══════════════════════════════════════════════════════
    //  listForLearner
    // ═══════════════════════════════════════════════════════

    @Test
    void listForLearnerReturnsAllRequests() {
        when(sessionRequestRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId()))
                .thenReturn(List.of(pendingRequest, acceptedRequest, declinedRequest));

        List<SessionRequest> result = sessionRequestService.listForLearner(learner);

        assertEquals(3, result.size());
    }
}
