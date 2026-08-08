package com.skillswap.learning;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LearningRoadmapServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private CareerPathRepository careerPathRepository;
    @Mock
    private LearnerRoadmapRepository learnerRoadmapRepository;
    @Mock
    private RoadmapModuleRepository roadmapModuleRepository;
    @Mock
    private RoadmapLessonRepository roadmapLessonRepository;
    @Mock
    private RoadmapProjectRepository roadmapProjectRepository;
    @Mock
    private RoadmapResourceRepository roadmapResourceRepository;
    @Mock
    private RoadmapSessionRepository roadmapSessionRepository;
    @Mock
    private RoadmapProgressRepository roadmapProgressRepository;
    @Mock
    private RoadmapCertificateRepository roadmapCertificateRepository;

    @InjectMocks
    private LearningRoadmapService service;

    /** Stateful progress store keyed by lesson id (per roadmap in these tests). */
    private final Map<Long, RoadmapProgress> progressByLesson = new LinkedHashMap<>();
    private final List<RoadmapCertificate> savedCertificates = new ArrayList<>();
    private long progressId = 1;

    private User learner;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(42L);

        // The learner row is pessimistically locked for lifecycle transitions.
        when(userRepository.findByIdWithLock(42L)).thenReturn(Optional.of(learner));

        // Stateful progress repo so completion toggles behave like the real DB.
        when(roadmapProgressRepository.findByLearnerRoadmapId(anyLong()))
                .thenAnswer(inv -> new ArrayList<>(progressByLesson.values()));
        when(roadmapProgressRepository.findByLearnerRoadmapIdAndLessonId(anyLong(), anyLong()))
                .thenAnswer(inv -> Optional.ofNullable(progressByLesson.get(inv.getArgument(1))));
        doAnswer(inv -> {
            progressByLesson.remove(inv.getArgument(1));
            return null;
        }).when(roadmapProgressRepository).deleteByLearnerRoadmapIdAndLessonId(anyLong(), anyLong());
        when(roadmapProgressRepository.save(any(RoadmapProgress.class)))
                .thenAnswer(inv -> {
                    RoadmapProgress p = inv.getArgument(0);
                    if (p.getId() == null) {
                        p.setId(progressId++);
                    }
                    progressByLesson.put(p.getLesson().getId(), p);
                    return p;
                });
        when(roadmapProgressRepository.countByLearnerRoadmapId(anyLong()))
                .thenAnswer(inv -> (long) progressByLesson.size());

        // Certificate store — exists() reflects certificates already saved so
        // certificates are only issued once per milestone (like the real DB).
        when(roadmapCertificateRepository.existsByLearnerRoadmapIdAndCode(anyLong(), anyString()))
                .thenAnswer(inv -> savedCertificates.stream()
                        .anyMatch(c -> c.getCode().equals(inv.getArgument(1))));
        when(roadmapCertificateRepository.save(any(RoadmapCertificate.class)))
                .thenAnswer(inv -> {
                    RoadmapCertificate c = inv.getArgument(0);
                    if (c.getId() == null) {
                        c.setId((long) (savedCertificates.size() + 1));
                    }
                    savedCertificates.add(c);
                    return c;
                });

        // Default empty catalog reads — individual tests re-stub as needed.
        when(roadmapLessonRepository.findByModuleCareerPathIdOrderByOrderIndexAsc(anyLong()))
                .thenReturn(List.of());
        when(roadmapModuleRepository.findByCareerPathIdOrderByOrderIndexAsc(anyLong()))
                .thenReturn(List.of());
        when(roadmapProjectRepository.findByCareerPathIdOrderByOrderIndexAsc(anyLong()))
                .thenReturn(List.of());
        when(roadmapResourceRepository.findByCareerPathIdOrderByOrderIndexAsc(anyLong()))
                .thenReturn(List.of());
        when(roadmapSessionRepository.findByCareerPathIdOrderByOrderIndexAsc(anyLong()))
                .thenReturn(List.of());
        when(roadmapCertificateRepository.findByLearnerRoadmapIdOrderByIssuedAtDesc(anyLong()))
                .thenReturn(List.of());
        when(learnerRoadmapRepository.save(any(LearnerRoadmap.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    /* ───────────────────────── Fixtures ───────────────────────── */

    private CareerPath careerPath(Long id, String slug) {
        CareerPath path = new CareerPath();
        path.setId(id);
        path.setName("Career " + slug);
        path.setSlug(slug);
        path.setDescription("A test career path.");
        path.setDurationWeeks(16);
        path.setDifficulty("Intermediate");
        path.setSkills("Java,Spring");
        path.setIcon("code");
        path.setActive(true);
        return path;
    }

    private RoadmapModule module(Long id, CareerPath path, String title) {
        RoadmapModule module = new RoadmapModule();
        module.setId(id);
        module.setCareerPath(path);
        module.setTitle(title);
        module.setOrderIndex(0);
        module.setEstimatedWeeks(2);
        return module;
    }

    private RoadmapLesson lesson(Long id, RoadmapModule module, String title) {
        RoadmapLesson lesson = new RoadmapLesson();
        lesson.setId(id);
        lesson.setModule(module);
        lesson.setTitle(title);
        lesson.setDescription("Lesson " + title);
        lesson.setAssignment("Assignment " + title);
        lesson.setDurationMinutes(60);
        lesson.setOrderIndex(0);
        return lesson;
    }

    private LearnerRoadmap roadmap(Long id, RoadmapStatus status, int progressPercent, CareerPath path) {
        LearnerRoadmap roadmap = new LearnerRoadmap();
        roadmap.setId(id);
        roadmap.setLearner(learner);
        roadmap.setCareerPath(path);
        roadmap.setStatus(status);
        roadmap.setProgressPercent(progressPercent);
        return roadmap;
    }

    /** A career path with 2 modules x 6 lessons each (12 lessons total). */
    private CareerPath javaPath() {
        CareerPath path = careerPath(1L, "java-backend-developer");
        RoadmapModule m1 = module(1L, path, "Java Fundamentals");
        RoadmapModule m2 = module(2L, path, "Spring Boot");
        List<RoadmapLesson> lessons = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            lessons.add(lesson((long) i, m1, "Java Lesson " + i));
        }
        for (int i = 7; i <= 12; i++) {
            lessons.add(lesson((long) i, m2, "Spring Lesson " + i));
        }
        when(roadmapLessonRepository.findByModuleCareerPathIdOrderByOrderIndexAsc(1L)).thenReturn(lessons);
        when(roadmapModuleRepository.findByCareerPathIdOrderByOrderIndexAsc(1L))
                .thenReturn(List.of(m1, m2));
        for (RoadmapLesson l : lessons) {
            when(roadmapLessonRepository.findById(l.getId())).thenReturn(Optional.of(l));
        }
        return path;
    }

    /* ───────────────────────── Tests ───────────────────────── */

    @Test
    void createRoadmapArchivesExistingActiveAndCreatesNewActive() {
        CareerPath java = javaPath();
        when(careerPathRepository.findById(1L)).thenReturn(Optional.of(java));
        LearnerRoadmap existingActive = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        when(learnerRoadmapRepository.findFirstByLearnerIdAndStatusOrderByUpdatedAtDesc(
                42L, RoadmapStatus.ACTIVE)).thenReturn(Optional.of(existingActive));

        LearningDtos.LearnerRoadmapDetailDto created = service.createRoadmap(learner, 1L);

        assertThat(created.status()).isEqualTo("ACTIVE");
        assertThat(created.progressPercent()).isZero();
        assertThat(created.careerPath().name()).isEqualTo("Career java-backend-developer");
        // Previous roadmap preserved but archived.
        assertThat(existingActive.getStatus()).isEqualTo(RoadmapStatus.ARCHIVED);
        verify(learnerRoadmapRepository).save(existingActive);
    }

    @Test
    void createRoadmapRejectsUnknownCareerPath() {
        when(careerPathRepository.findById(999L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createRoadmap(learner, 999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Career path not found");
        verify(learnerRoadmapRepository, never()).save(any(LearnerRoadmap.class));
    }

    @Test
    void createRoadmapRejectsInactiveCareerPath() {
        CareerPath inactive = careerPath(1L, "retired-path");
        inactive.setActive(false);
        when(careerPathRepository.findById(1L)).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> service.createRoadmap(learner, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Career path not found");
    }

    @Test
    void toggleLessonDerivesProgressFromCompletedLessons() {
        CareerPath java = javaPath();
        LearnerRoadmap roadmap = roadmap(7L, RoadmapStatus.ACTIVE, 0, java);
        when(learnerRoadmapRepository.findById(7L)).thenReturn(Optional.of(roadmap));

        service.toggleLesson(learner, 7L, 1L, true);
        service.toggleLesson(learner, 7L, 2L, true);
        service.toggleLesson(learner, 7L, 3L, true);

        assertThat(roadmap.getProgressPercent()).isEqualTo(25);
        assertThat(roadmap.getCompletedAt()).isNull();
    }

    @Test
    void toggleLessonUnmarkReducesProgress() {
        CareerPath java = javaPath();
        LearnerRoadmap roadmap = roadmap(7L, RoadmapStatus.ACTIVE, 0, java);
        when(learnerRoadmapRepository.findById(7L)).thenReturn(Optional.of(roadmap));

        service.toggleLesson(learner, 7L, 1L, true);
        service.toggleLesson(learner, 7L, 2L, true);
        service.toggleLesson(learner, 7L, 3L, true);
        service.toggleLesson(learner, 7L, 2L, false);

        assertThat(roadmap.getProgressPercent()).isEqualTo(17);
    }

    @Test
    void toggleLessonIssuesModuleAndCompletionCertificatesAtFullCompletion() {
        CareerPath java = javaPath();
        LearnerRoadmap roadmap = roadmap(7L, RoadmapStatus.ACTIVE, 0, java);
        when(learnerRoadmapRepository.findById(7L)).thenReturn(Optional.of(roadmap));

        for (long i = 1; i <= 12; i++) {
            service.toggleLesson(learner, 7L, i, true);
        }

        assertThat(roadmap.getProgressPercent()).isEqualTo(100);
        assertThat(roadmap.getCompletedAt()).isNotNull();
        assertThat(savedCertificates).hasSize(3);
        assertThat(savedCertificates).extracting(RoadmapCertificate::getCode)
                .containsExactlyInAnyOrder(
                        "java-backend-developer-MOD1",
                        "java-backend-developer-MOD2",
                        "java-backend-developer-COMPLETE");
    }

    @Test
    void toggleLessonRejectsLessonFromAnotherCareerPath() {
        CareerPath java = javaPath();
        CareerPath python = careerPath(2L, "python-developer");
        RoadmapLesson foreign = lesson(200L, module(20L, python, "Flask"), "Flask Basics");
        when(roadmapLessonRepository.findById(200L)).thenReturn(Optional.of(foreign));

        LearnerRoadmap roadmap = roadmap(7L, RoadmapStatus.ACTIVE, 0, java);
        when(learnerRoadmapRepository.findById(7L)).thenReturn(Optional.of(roadmap));

        assertThatThrownBy(() -> service.toggleLesson(learner, 7L, 200L, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong");
    }

    @Test
    void updateStatusSwitchArchivesCurrentActiveAndPromotes() {
        CareerPath java = javaPath();
        LearnerRoadmap active = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        LearnerRoadmap other = roadmap(6L, RoadmapStatus.ARCHIVED, 18, java);
        when(learnerRoadmapRepository.findById(6L)).thenReturn(Optional.of(other));
        when(learnerRoadmapRepository.findFirstByLearnerIdAndStatusOrderByUpdatedAtDesc(
                42L, RoadmapStatus.ACTIVE)).thenReturn(Optional.of(active));

        LearningDtos.LearnerRoadmapSummaryDto result = service.updateStatus(learner, 6L, "switch");

        assertThat(result.status()).isEqualTo("ACTIVE");
        assertThat(result.progressPercent()).isEqualTo(18);
        assertThat(active.getStatus()).isEqualTo(RoadmapStatus.ARCHIVED);
    }

    @Test
    void updateStatusSwitchRejectsAlreadyActiveRoadmap() {
        CareerPath java = javaPath();
        LearnerRoadmap active = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        when(learnerRoadmapRepository.findById(5L)).thenReturn(Optional.of(active));

        assertThatThrownBy(() -> service.updateStatus(learner, 5L, "switch"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already active");
    }

    @Test
    void updateStatusArchiveArchivesActiveRoadmap() {
        CareerPath java = javaPath();
        LearnerRoadmap active = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        when(learnerRoadmapRepository.findById(5L)).thenReturn(Optional.of(active));

        LearningDtos.LearnerRoadmapSummaryDto result = service.updateStatus(learner, 5L, "archive");

        assertThat(result.status()).isEqualTo("ARCHIVED");
        assertThat(active.getStatus()).isEqualTo(RoadmapStatus.ARCHIVED);
    }

    @Test
    void updateStatusRejectsUnknownAction() {
        CareerPath java = javaPath();
        LearnerRoadmap roadmap = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        when(learnerRoadmapRepository.findById(5L)).thenReturn(Optional.of(roadmap));

        assertThatThrownBy(() -> service.updateStatus(learner, 5L, "explode"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid action");
    }

    @Test
    void deleteRoadmapRejectsRoadmapWithProgress() {
        CareerPath java = javaPath();
        LearnerRoadmap started = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        when(learnerRoadmapRepository.findById(5L)).thenReturn(Optional.of(started));

        assertThatThrownBy(() -> service.deleteRoadmap(learner, 5L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("never been started");
        verify(learnerRoadmapRepository, never()).delete(any(LearnerRoadmap.class));
    }

    @Test
    void deleteRoadmapRemovesNeverStartedRoadmapWithItsProgressAndCertificates() {
        CareerPath java = javaPath();
        LearnerRoadmap fresh = roadmap(5L, RoadmapStatus.ACTIVE, 0, java);
        when(learnerRoadmapRepository.findById(5L)).thenReturn(Optional.of(fresh));

        service.deleteRoadmap(learner, 5L);

        verify(learnerRoadmapRepository).delete(fresh);
        verify(roadmapProgressRepository).deleteAll(any());
        verify(roadmapCertificateRepository).deleteAll(any());
    }

    @Test
    void getRoadmapRejectsAnotherLearnersRoadmap() {
        CareerPath java = javaPath();
        LearnerRoadmap someoneElses = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        User other = new User();
        other.setId(99L);
        someoneElses.setLearner(other);
        when(learnerRoadmapRepository.findById(5L)).thenReturn(Optional.of(someoneElses));

        assertThatThrownBy(() -> service.getRoadmap(learner, 5L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Roadmap not found");
    }

    @Test
    void getActiveRoadmapReturnsNullWhenLearnerHasNone() {
        when(learnerRoadmapRepository.findFirstByLearnerIdAndStatusOrderByUpdatedAtDesc(
                42L, RoadmapStatus.ACTIVE)).thenReturn(Optional.empty());

        assertThat(service.getActiveRoadmap(learner)).isNull();
    }

    @Test
    void listRoadmapsReturnsAllOwnedRoadmapsWithDerivedCounts() {
        CareerPath java = javaPath();
        LearnerRoadmap active = roadmap(5L, RoadmapStatus.ACTIVE, 42, java);
        LearnerRoadmap archived = roadmap(6L, RoadmapStatus.ARCHIVED, 18, java);
        when(learnerRoadmapRepository.findByLearnerIdOrderByCreatedAtDesc(42L))
                .thenReturn(List.of(active, archived));

        List<LearningDtos.LearnerRoadmapSummaryDto> result = service.listRoadmaps(learner);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).status()).isEqualTo("ACTIVE");
        assertThat(result.get(0).totalLessons()).isEqualTo(12);
        assertThat(result.get(1).canDelete()).isFalse();
    }
}
