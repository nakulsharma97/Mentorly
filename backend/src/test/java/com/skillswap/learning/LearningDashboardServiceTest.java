package com.skillswap.learning;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.certification.UserCertification;
import com.skillswap.certification.UserCertificationRepository;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserProjectService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LearningDashboardServiceTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserCertificationRepository certificationRepository;
    @Mock
    private LearnerTodoRepository learnerTodoRepository;
    @Mock
    private SessionNoteRepository sessionNoteRepository;
    @Mock
    private MentorReviewRepository mentorReviewRepository;
    @Mock
    private UserProjectService userProjectService;

    @InjectMocks
    private LearningDashboardService service;

    private final List<LearnerTodo> savedTodos = new ArrayList<>();
    private final List<SessionNote> savedNotes = new ArrayList<>();
    private long todoId = 1;

    private User learner;
    private User mentorRahul;
    private User mentorAnkit;

    @BeforeEach
    void setUp() {
        learner = user(10L, "Aisha Khan", "aisha");
        mentorRahul = user(20L, "Rahul Sharma", "rahul");
        mentorRahul.setHeadline("Senior Java Developer");
        mentorAnkit = user(21L, "Ankit Verma", "ankit");
        mentorAnkit.setHeadline("Full Stack Engineer");

        when(learnerTodoRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        when(sessionNoteRepository.findTop5ByLearnerIdOrderByUpdatedAtDesc(10L)).thenReturn(List.of());
        when(sessionNoteRepository.countByLearnerId(10L)).thenReturn(0L);
        when(certificationRepository.findByUserIdOrderByIssuedAtDesc(10L)).thenReturn(List.of());
        when(userProjectService.listProjects(learner)).thenReturn(List.of());
        when(sessionNoteRepository.findByLearnerIdAndBookingIdIn(anyLong(), anyCollection()))
                .thenReturn(List.of());
        when(mentorReviewRepository.averageRatingByMentorIdsIn(anyCollection())).thenReturn(List.of());

        doAnswer(inv -> {
            LearnerTodo todo = inv.getArgument(0);
            if (todo.getId() == null) {
                todo.setId(todoId++);
            }
            savedTodos.add(todo);
            return todo;
        }).when(learnerTodoRepository).save(any(LearnerTodo.class));
        when(learnerTodoRepository.findByIdAndLearnerId(anyLong(), eq(10L)))
                .thenAnswer(inv -> savedTodos.stream()
                        .filter(t -> t.getId().equals(inv.getArgument(0)))
                        .findFirst());
    }

    /* ───────────────────────── Fixtures ───────────────────────── */

    private User user(Long id, String fullName, String username) {
        User user = new User();
        user.setId(id);
        user.setFullName(fullName);
        user.setUsername(username);
        user.setProfileImageUrl("https://i.pravatar.cc/150?u=" + username);
        return user;
    }

    private SkillSession session(Long id, User mentor, String title, OffsetDateTime start, int hours) {
        SkillSession session = new SkillSession();
        session.setId(id);
        session.setMentor(mentor);
        session.setTitle(title);
        session.setStartTime(start);
        session.setEndTime(start.plusHours(hours));
        session.setMeetingLink("https://meet.google.com/abc-defg-hij");
        return session;
    }

    private Booking booking(Long id, SkillSession session, BookingStatus status, int createdDay) {
        Booking booking = new Booking();
        booking.setId(id);
        booking.setSession(session);
        booking.setLearner(learner);
        booking.setBookingStatus(status);
        booking.setCreatedAt(OffsetDateTime.of(2026, 7, createdDay, 9, 0, 0, 0, ZoneOffset.UTC));
        return booking;
    }

    private UserCertification cert(Long id, String title, int day) {
        UserCertification cert = new UserCertification();
        cert.setId(id);
        cert.setUser(learner);
        cert.setTitle(title);
        cert.setCode("CODE-" + id);
        cert.setIssuedAt(OffsetDateTime.of(2026, 7, day, 12, 0, 0, 0, ZoneOffset.UTC));
        return cert;
    }

    /**
     * Three completed + one upcoming booking, two distinct mentors. Dates are
     * relative to now. Note the COMPLETED "React Basics" booking deliberately
     * points at a FUTURE session — this exercises that the timeline orders by
     * the session's effective end time, not by status.
     */
    private List<Booking> threeCompletedAndOneUpcoming() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        SkillSession javaColl = session(1L, mentorRahul, "Java Collections", now.minusDays(5), 2);
        SkillSession springBoot = session(2L, mentorRahul, "Spring Boot REST API", now.minusDays(2), 1);
        SkillSession reactBasics = session(3L, mentorAnkit, "React Basics", now.plusDays(3), 1);
        return List.of(
                booking(11L, reactBasics, BookingStatus.COMPLETED, 4),
                booking(12L, springBoot, BookingStatus.COMPLETED, 2),
                booking(13L, javaColl, BookingStatus.COMPLETED, 1),
                booking(14L, reactBasics, BookingStatus.CONFIRMED, 5));
    }

    /* ───────────────────────── Tests ───────────────────────── */

    @Test
    void dashboardAggregatesRealBookingsIntoStats() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.learnerName()).isEqualTo("Aisha Khan");
        // 3 completed, 1 upcoming (confirmed + startTime in the future).
        assertThat(dashboard.overview().completedSessions()).isEqualTo(3);
        assertThat(dashboard.overview().upcomingSessions()).isEqualTo(1);
        // Java Collections (2h) + Spring Boot (1h) + React Basics (1h) = 4h.
        assertThat(dashboard.overview().learningHours()).isEqualTo(4.0);
        // Two distinct mentors across completed bookings.
        assertThat(dashboard.overview().activeMentors()).isEqualTo(2);
        // No certifications or notes in this fixture.
        assertThat(dashboard.overview().certificates()).isZero();
        assertThat(dashboard.overview().notes()).isZero();
        assertThat(dashboard.statistics().sessionsCompleted()).isEqualTo(3);
        assertThat(dashboard.statistics().mentorsLearnedFrom()).isEqualTo(2);
        assertThat(dashboard.statistics().certificatesEarned()).isZero();
        assertThat(dashboard.statistics().upcomingSessions()).isEqualTo(1);
        assertThat(dashboard.hasCertificates()).isFalse();
    }

    @Test
    void continueLearningPrefersNextUpcomingOverCompleted() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());

        var dashboard = service.getDashboard(learner);

        // The CONFIRMED "React Basics" (now + 3d) beats the last completed one.
        assertThat(dashboard.continueLearning()).isNotNull();
        assertThat(dashboard.continueLearning().type()).isEqualTo("UPCOMING");
        assertThat(dashboard.continueLearning().title()).isEqualTo("React Basics");
        assertThat(dashboard.continueLearning().mentorName()).isEqualTo("Ankit Verma");
        assertThat(dashboard.continueLearning().startTime()).isNotNull();
    }

    @Test
    void continueLearningPrefersInProgressSession() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        SkillSession live = session(9L, mentorRahul, "Spring Boot Live", now.minusMinutes(30), 1);
        List<Booking> bookings = new ArrayList<>(threeCompletedAndOneUpcoming());
        bookings.add(booking(99L, live, BookingStatus.IN_PROGRESS, 6));
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(bookings);

        var dashboard = service.getDashboard(learner);

        // An in-progress session always wins the Continue Learning card.
        assertThat(dashboard.continueLearning()).isNotNull();
        assertThat(dashboard.continueLearning().type()).isEqualTo("IN_PROGRESS");
        assertThat(dashboard.continueLearning().title()).isEqualTo("Spring Boot Live");
        assertThat(dashboard.continueLearning().mentorName()).isEqualTo("Rahul Sharma");
    }

    @Test
    void continueLearningFallsBackToLastCompletedSession() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<Booking> bookings = List.of(
                booking(21L, session(1L, mentorRahul, "Java OOP", now.minusDays(10), 2),
                        BookingStatus.COMPLETED, 1),
                booking(22L, session(2L, mentorRahul, "Spring Boot Basics", now.minusDays(2), 1),
                        BookingStatus.COMPLETED, 2));
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(bookings);

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.continueLearning()).isNotNull();
        assertThat(dashboard.continueLearning().type()).isEqualTo("COMPLETED");
        assertThat(dashboard.continueLearning().title()).isEqualTo("Spring Boot Basics");
        assertThat(dashboard.continueLearning().hasNote()).isFalse();
    }

    @Test
    void dashboardActiveMentorsCarrySessionsUpcomingAndRating() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());
        when(mentorReviewRepository.averageRatingByMentorIdsIn(anyCollection()))
                .thenReturn(List.of(new Object[]{20L, 4.8}, new Object[]{21L, 4.5}));

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.activeMentors()).hasSize(2);
        LearningDashboardDtos.ActiveMentorDto rahul = dashboard.activeMentors().stream()
                .filter(m -> m.mentorId().equals(20L)).findFirst().orElseThrow();
        assertThat(rahul.totalSessions()).isEqualTo(2); // two completed sessions with Rahul
        assertThat(rahul.upcomingSessions()).isZero();  // the upcoming booking is with Ankit
        assertThat(rahul.rating()).isEqualTo(4.8);
        assertThat(rahul.specialization()).isEqualTo("Senior Java Developer");

        LearningDashboardDtos.ActiveMentorDto ankit = dashboard.activeMentors().stream()
                .filter(m -> m.mentorId().equals(21L)).findFirst().orElseThrow();
        assertThat(ankit.totalSessions()).isEqualTo(1);
        assertThat(ankit.upcomingSessions()).isEqualTo(1);
    }

    @Test
    void dashboardCalendarListsUpcomingConfirmedSessionsSorted() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.calendar()).hasSize(1);
        assertThat(dashboard.calendar().get(0).title()).isEqualTo("React Basics");
        assertThat(dashboard.calendar().get(0).canJoin()).isTrue();
        assertThat(dashboard.calendar().get(0).meetingLink()).contains("meet.google.com");
    }

    @Test
    void timelineCoversAllBookingStatusesAsEventsNewestFirst() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());

        var dashboard = service.getDashboard(learner);

        List<String> types = dashboard.timeline().stream()
                .map(LearningDashboardDtos.TimelineItemDto::eventType)
                .toList();
        assertThat(types).contains("SESSION_COMPLETED", "SESSION_ACCEPTED");

        // Strictly newest-first by event time.
        var times = dashboard.timeline().stream()
                .map(LearningDashboardDtos.TimelineItemDto::eventTime)
                .toList();
        assertThat(times).isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    @Test
    void timelineIncludesNotesAndCertificateEvents() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());
        when(certificationRepository.findByUserIdOrderByIssuedAtDesc(10L))
                .thenReturn(List.of(cert(1L, "Focused Learner", 6)));

        SessionNote note = new SessionNote();
        note.setId(4L);
        note.setLearner(learner);
        note.setContent("Great session.");
        note.setUpdatedAt(OffsetDateTime.of(2026, 8, 6, 18, 0, 0, 0, ZoneOffset.UTC));
        SkillSession springBoot = session(2L, mentorRahul, "Spring Boot REST API",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(2), 1);
        Booking springBooking = booking(12L, springBoot, BookingStatus.COMPLETED, 2);
        note.setBooking(springBooking);
        when(sessionNoteRepository.findTop5ByLearnerIdOrderByUpdatedAtDesc(10L))
                .thenReturn(List.of(note));

        var dashboard = service.getDashboard(learner);

        List<String> types = dashboard.timeline().stream()
                .map(LearningDashboardDtos.TimelineItemDto::eventType)
                .toList();
        assertThat(types).contains("NOTES_ADDED", "CERTIFICATE_EARNED");
    }

    @Test
    void todoSuggestionsAreDerivedFromRealData() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());

        var dashboard = service.getDashboard(learner);

        List<String> texts = dashboard.todoSuggestions().stream()
                .map(LearningDashboardDtos.TodoSuggestionDto::text)
                .toList();
        // Upcoming confirmed session within 14 days → attend suggestion.
        assertThat(texts).anyMatch(t -> t.startsWith("Attend upcoming session:"));
        // Completed sessions have no notes → notes suggestion.
        assertThat(texts).anyMatch(t -> t.startsWith("Add notes for"));
        // Completed sessions + no projects → project suggestion.
        assertThat(texts).anyMatch(t -> t.startsWith("Upload a project"));
        // No certificate in the fixture → no download suggestion.
        assertThat(texts).noneMatch(t -> t.startsWith("Download your certificate"));
        // Upcoming exists → no "book next" suggestion.
        assertThat(texts).noneMatch(t -> t.startsWith("Book your next"));
    }

    @Test
    void todoSuggestionsOfferBookingWhenNoUpcomingSessions() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.todoSuggestions()).extracting(
                        LearningDashboardDtos.TodoSuggestionDto::text)
                .contains("Book your next session with a mentor");
    }

    @Test
    void dashboardRecentActivityIsChronologicalAndIncludesTodosAndCerts() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(threeCompletedAndOneUpcoming());
        when(certificationRepository.findByUserIdOrderByIssuedAtDesc(10L))
                .thenReturn(List.of(cert(1L, "Focused Learner", 6)));

        LearnerTodo doneTodo = new LearnerTodo();
        doneTodo.setId(9L);
        doneTodo.setLearner(learner);
        doneTodo.setTask("Submit Java assignment");
        doneTodo.setDone(true);
        doneTodo.setCreatedAt(OffsetDateTime.of(2026, 8, 5, 8, 0, 0, 0, ZoneOffset.UTC));
        doneTodo.setUpdatedAt(OffsetDateTime.of(2026, 8, 6, 18, 0, 0, 0, ZoneOffset.UTC));
        when(learnerTodoRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(doneTodo));

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.todos()).hasSize(1);
        assertThat(dashboard.statistics().certificatesEarned()).isEqualTo(1);
        assertThat(dashboard.hasCertificates()).isTrue();

        List<String> types = dashboard.recentActivity().stream()
                .map(LearningDashboardDtos.ActivityItemDto::type)
                .toList();
        assertThat(types).contains("TODO_COMPLETED", "CERTIFICATE", "SCHEDULED", "COMPLETED");
        // Strictly newest-first.
        var times = dashboard.recentActivity().stream()
                .map(LearningDashboardDtos.ActivityItemDto::timestamp)
                .toList();
        assertThat(times).isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    @Test
    void statisticsIncludeNotesStreakAndMonthlyHours() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<Booking> bookings = List.of(
                booking(51L, session(1L, mentorRahul, "Streak Day A", now.minusHours(30), 1),
                        BookingStatus.COMPLETED, 1),
                booking(52L, session(2L, mentorRahul, "Streak Day B", now.minusHours(6), 1),
                        BookingStatus.COMPLETED, 2));
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(bookings);
        when(sessionNoteRepository.countByLearnerId(10L)).thenReturn(3L);

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.overview().notes()).isEqualTo(3);
        assertThat(dashboard.statistics().notesCreated()).isEqualTo(3);
        // Two consecutive completed days ending today → streak 2.
        assertThat(dashboard.statistics().currentStreak()).isEqualTo(2);
        // 2 hours across the two sessions (1h each); at the very start of a new
        // month the earlier session can fall into the previous month → 1h.
        assertThat(dashboard.statistics().monthlyHours()).isIn(2.0, 1.0);
        assertThat(dashboard.statistics().upcomingSessions()).isZero();
    }

    @Test
    void dashboardIsEmptySafeForBrandNewLearner() {
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());

        var dashboard = service.getDashboard(learner);

        assertThat(dashboard.overview().completedSessions()).isZero();
        assertThat(dashboard.overview().certificates()).isZero();
        assertThat(dashboard.continueLearning()).isNull();
        assertThat(dashboard.timeline()).isEmpty();
        assertThat(dashboard.activeMentors()).isEmpty();
        assertThat(dashboard.calendar()).isEmpty();
        assertThat(dashboard.todoSuggestions())
                .extracting(LearningDashboardDtos.TodoSuggestionDto::text)
                .containsExactly("Book your next session with a mentor");
        assertThat(dashboard.statistics().learningHours()).isZero();
    }

    @Test
    void historySupportsSearchFilterAndPagination() {
        List<Booking> page = List.of(booking(11L,
                session(1L, mentorRahul, "Java Collections",
                        OffsetDateTime.now(ZoneOffset.UTC).minusDays(1), 2),
                BookingStatus.COMPLETED, 1));
        when(bookingRepository.searchLearnerHistory(eq(10L), eq(BookingStatus.COMPLETED), eq("java"),
                any(PageRequest.class)))
                .thenReturn(new PageImpl<>(page, PageRequest.of(0, 10), 1));

        var history = service.getHistory(learner, "java", "COMPLETED", 0, 10);

        assertThat(history.items()).hasSize(1);
        assertThat(history.total()).isEqualTo(1);
        assertThat(history.items().get(0).title()).isEqualTo("Java Collections");
        assertThat(history.items().get(0).hasNote()).isFalse();
    }

    @Test
    void historyTreatsUnknownStatusAsNoFilter() {
        List<Booking> page = List.of();
        when(bookingRepository.searchLearnerHistory(eq(10L), isNull(), eq(""), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(page, PageRequest.of(0, 10), 0));

        var history = service.getHistory(learner, "", "BOGUS_STATUS", 0, 10);

        assertThat(history.items()).isEmpty();
        assertThat(history.total()).isZero();
    }

    @Test
    void listTodosReturnsOnlyTheLearnersTodos() {
        LearnerTodo mine = new LearnerTodo();
        mine.setId(3L);
        mine.setLearner(learner);
        mine.setTask("Attend Spring Boot session");
        mine.setDone(false);
        when(learnerTodoRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(mine));

        var todos = service.listTodos(learner);

        assertThat(todos).hasSize(1);
        assertThat(todos.get(0).task()).isEqualTo("Attend Spring Boot session");
        assertThat(todos.get(0).id()).isEqualTo(3L);
    }

    @Test
    void createTodoValidatesAndPersists() {
        LearningDashboardDtos.TodoDto created = service.createTodo(learner, "  Revise Collections  ");

        assertThat(created.task()).isEqualTo("Revise Collections");
        assertThat(created.done()).isFalse();
        assertThat(savedTodos).hasSize(1);

        LearningDashboardDtos.TodoDto prefilled = service.createTodo(learner, "Download certificate", true);
        assertThat(prefilled.done()).isTrue();
        assertThat(savedTodos).hasSize(2);

        assertThatThrownBy(() -> service.createTodo(learner, "   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void updateTodoOnlyAllowsOwnerAndSupportsPartialUpdate() {
        LearningDashboardDtos.TodoDto created = service.createTodo(learner, "Revise Collections");

        LearningDashboardDtos.TodoDto updated = service.updateTodo(learner, created.id(), null, true);

        assertThat(updated.done()).isTrue();
        assertThat(updated.task()).isEqualTo("Revise Collections");

        LearningDashboardDtos.TodoDto renamed = service.updateTodo(learner, created.id(), "Revise Maps", null);
        assertThat(renamed.task()).isEqualTo("Revise Maps");
        assertThat(renamed.done()).isTrue();

        assertThatThrownBy(() -> service.updateTodo(learner, 999L, null, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void saveNoteUpsertsSingleNotePerBookingAndGuardsOwnership() {
        SkillSession javaColl = session(1L, mentorRahul, "Java Collections",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(1), 2);
        Booking owned = booking(11L, javaColl, BookingStatus.COMPLETED, 1);
        when(bookingRepository.findById(11L)).thenReturn(Optional.of(owned));

        // Simulates the real store: one row per (booking, learner).
        SessionNote[] store = new SessionNote[1];
        when(sessionNoteRepository.findByBookingIdAndLearnerId(11L, 10L))
                .thenAnswer(inv -> Optional.ofNullable(store[0]));
        when(sessionNoteRepository.save(any(SessionNote.class)))
                .thenAnswer(inv -> {
                    store[0] = inv.getArgument(0);
                    return store[0];
                });

        var saved = service.saveNote(learner, 11L, "Key takeaways: List vs Set.");
        assertThat(saved.content()).isEqualTo("Key takeaways: List vs Set.");

        // Second save reuses the SAME entity — never a duplicate row.
        var updated = service.saveNote(learner, 11L, "Updated notes.");
        assertThat(updated.content()).isEqualTo("Updated notes.");
        assertThat(store[0].getContent()).isEqualTo("Updated notes.");
        assertThat(store[0].getBooking().getId()).isEqualTo(11L);
    }

    @Test
    void getNoteRejectsAnotherLearnersBooking() {
        Booking someoneElses = booking(11L, session(1L, mentorRahul, "Java Collections",
                OffsetDateTime.now(ZoneOffset.UTC).minusDays(1), 2),
                BookingStatus.COMPLETED, 1);
        User other = user(99L, "Other Learner", "other");
        someoneElses.setLearner(other);
        when(bookingRepository.findById(11L)).thenReturn(Optional.of(someoneElses));

        assertThatThrownBy(() -> service.getNote(learner, 11L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }
}
