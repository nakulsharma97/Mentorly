package com.mentorly.learning;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.session.SessionRepository;
import com.mentorly.session.SkillSession;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LearnerTaskServiceTest {

    @Mock
    private LearnerTaskRepository learnerTaskRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private SessionNoteRepository sessionNoteRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private LearnerTaskService service;

    private final List<LearnerTask> savedTasks = new ArrayList<>();
    private long taskId = 1;

    private User learner;
    private User mentor;

    @BeforeEach
    void setUp() {
        learner = user(10L, "Aisha Khan");
        mentor = user(20L, "Rahul Sharma");

        doAnswer(inv -> {
            LearnerTask task = inv.getArgument(0);
            if (task.getId() == null) {
                task.setId(taskId++);
                savedTasks.add(task);
            }
            return task;
        }).when(learnerTaskRepository).save(any(LearnerTask.class));

        when(learnerTaskRepository.findByLearnerIdOrderByCreatedAtDesc(10L))
                .thenAnswer(inv -> new ArrayList<>(savedTasks));
        when(learnerTaskRepository.findByIdAndLearnerId(anyLong(), anyLong()))
                .thenAnswer(inv -> savedTasks.stream()
                        .filter(t -> t.getId().equals(inv.getArgument(0))
                                && t.getLearner().getId().equals(inv.getArgument(1)))
                        .findFirst());
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(List.of());
        when(userRepository.findById(20L)).thenReturn(Optional.of(mentor));
    }

    private User user(Long id, String name) {
        User u = new User();
        u.setId(id);
        u.setFullName(name);
        return u;
    }

    @Test
    void createTaskRequiresTitle() {
        assertThatThrownBy(() -> service.createTask(learner,
                new LearnerTaskDtos.TaskCreateRequest("   ", null, null, null, null, null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Task title is required");
    }

    @Test
    void createTaskAppliesDefaultsAndPersists() {
        LearnerTaskDtos.TaskDto dto = service.createTask(learner,
                new LearnerTaskDtos.TaskCreateRequest("Practice binary search", "Two-pointer practice",
                        "PRACTICE", "HIGH", OffsetDateTime.now().plusDays(1), null, null, false, null));

        assertThat(dto.id()).isNotNull();
        assertThat(dto.title()).isEqualTo("Practice binary search");
        assertThat(dto.type()).isEqualTo("PRACTICE");
        assertThat(dto.priority()).isEqualTo("HIGH");
        assertThat(dto.status()).isEqualTo("TODO");
        assertThat(dto.systemGenerated()).isFalse();
        assertThat(savedTasks).hasSize(1);
    }

    @Test
    void completeTaskSetsStatusAndCompletedAt() {
        LearnerTaskDtos.TaskDto created = service.createTask(learner,
                new LearnerTaskDtos.TaskCreateRequest("Read REST API docs", null, "READING",
                        "LOW", null, null, null, null, null));

        LearnerTaskDtos.TaskDto done = service.setCompleted(learner, created.id(), true);

        assertThat(done.status()).isEqualTo("COMPLETED");
        assertThat(done.completedAt()).isNotNull();

        LearnerTaskDtos.TaskDto reopened = service.setCompleted(learner, created.id(), false);
        assertThat(reopened.status()).isEqualTo("TODO");
        assertThat(reopened.completedAt()).isNull();
    }

    @Test
    void cannotTouchAnotherLearnersTask() {
        LearnerTaskDtos.TaskDto created = service.createTask(learner,
                new LearnerTaskDtos.TaskCreateRequest("Private task", null, null, null, null, null, null, null, null));

        User other = user(99L, "Someone Else");
        assertThatThrownBy(() -> service.setCompleted(other, created.id(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Task not found");
        // The failed update must not have persisted anything for the other user.
        assertThat(savedTasks).hasSize(1);
    }

    @Test
    void statsReflectsCompletionAndOverdue() {
        service.createTask(learner, new LearnerTaskDtos.TaskCreateRequest("Due yesterday",
                null, "PERSONAL", "MEDIUM", OffsetDateTime.now().minusDays(1), null, null, null, null));
        LearnerTaskDtos.TaskDto done = service.createTask(learner, new LearnerTaskDtos.TaskCreateRequest(
                "Completed today", null, "PRACTICE", "MEDIUM", OffsetDateTime.now(), null, null, null, null));
        service.setCompleted(learner, done.id(), true);
        service.createTask(learner, new LearnerTaskDtos.TaskCreateRequest("Later", null, "READING",
                "LOW", OffsetDateTime.now().plusDays(3), null, null, null, null));

        LearnerTaskDtos.TaskStatsDto stats = service.stats(learner);

        assertThat(stats.total()).isEqualTo(3);
        assertThat(stats.completed()).isEqualTo(1);
        assertThat(stats.remaining()).isEqualTo(2);
        assertThat(stats.overdue()).isEqualTo(1);
        assertThat(stats.streak()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void generatesDeterministicFollowUpsFromSessionsWithoutDuplicates() {
        SkillSession completedSession = session(100L, "Java Collections", OffsetDateTime.now().minusDays(2));
        Booking completed = booking(1L, completedSession, BookingStatus.COMPLETED);
        SkillSession upcomingSession = session(200L, "Spring Boot Deep Dive", OffsetDateTime.now().plusDays(2));
        Booking upcoming = booking(2L, upcomingSession, BookingStatus.CONFIRMED);

        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(List.of(completed, upcoming));
        when(sessionNoteRepository.findByBookingIdAndLearnerId(1L, 10L)).thenReturn(Optional.empty());
        when(sessionRepository.findById(100L)).thenReturn(Optional.of(completedSession));
        when(sessionRepository.findById(200L)).thenReturn(Optional.of(upcomingSession));

        List<LearnerTaskDtos.TaskDto> first = service.generateFromSessions(learner);

        assertThat(first).hasSize(2);
        assertThat(first).extracting(LearnerTaskDtos.TaskDto::type)
                .containsExactlyInAnyOrder("NOTE_REVIEW", "SESSION_FOLLOWUP");
        assertThat(first).allMatch(LearnerTaskDtos.TaskDto::systemGenerated);
        assertThat(first.get(0).sessionTitle()).isNotNull();

        // Idempotent — running again must not duplicate open tasks.
        List<LearnerTaskDtos.TaskDto> second = service.generateFromSessions(learner);
        assertThat(second).isEmpty();
    }

    @Test
    void completedSessionWithSavedNoteGetsNoReviewTask() {
        SkillSession session = session(100L, "Java Collections", OffsetDateTime.now().minusDays(2));
        Booking completed = booking(1L, session, BookingStatus.COMPLETED);
        when(bookingRepository.findByLearnerIdOrderByCreatedAtDesc(10L)).thenReturn(List.of(completed));
        when(sessionNoteRepository.findByBookingIdAndLearnerId(1L, 10L)).thenReturn(Optional.of(new SessionNote()));

        assertThat(service.generateFromSessions(learner)).isEmpty();
    }

    private SkillSession session(Long id, String title, OffsetDateTime start) {
        SkillSession session = new SkillSession();
        session.setId(id);
        session.setTitle(title);
        session.setStartTime(start);
        session.setEndTime(start.plusHours(1));
        session.setMentor(mentor);
        return session;
    }

    private Booking booking(Long id, SkillSession session, BookingStatus status) {
        Booking booking = new Booking();
        booking.setId(id);
        booking.setLearner(learner);
        booking.setSession(session);
        booking.setBookingStatus(status);
        return booking;
    }
}
