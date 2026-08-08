package com.skillswap.learning;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Business logic for the database-driven "My Learning" system.
 *
 * <p>Design rules enforced here:
 * <ul>
 *   <li>A learner owns many roadmaps but only one is ever {@code ACTIVE}.</li>
 *   <li>Changing the learning goal archives the current roadmap — previous
 *       progress is never deleted.</li>
 *   <li>Progress is derived from real lesson completions, never guessed.</li>
 *   <li>Certificates are issued only when a module (milestone) or the whole
 *       roadmap is completed.</li>
 *   <li>Roadmaps with any progress cannot be deleted.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class LearningRoadmapService {

    private final UserRepository userRepository;
    private final CareerPathRepository careerPathRepository;
    private final LearnerRoadmapRepository learnerRoadmapRepository;
    private final RoadmapModuleRepository roadmapModuleRepository;
    private final RoadmapLessonRepository roadmapLessonRepository;
    private final RoadmapProjectRepository roadmapProjectRepository;
    private final RoadmapResourceRepository roadmapResourceRepository;
    private final RoadmapSessionRepository roadmapSessionRepository;
    private final RoadmapProgressRepository roadmapProgressRepository;
    private final RoadmapCertificateRepository roadmapCertificateRepository;

    /* ─────────────────────────── Career path catalog ─────────────────────────── */

    @Transactional(readOnly = true)
    public List<LearningDtos.CareerPathSummaryDto> listCareerPaths() {
        return careerPathRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .map(LearningDtos.CareerPathSummaryDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public LearningDtos.CareerPathDetailDto getCareerPathDetail(Long careerPathId) {
        CareerPath path = requireCareerPath(careerPathId);
        List<RoadmapModule> modules = roadmapModuleRepository
                .findByCareerPathIdOrderByOrderIndexAsc(path.getId());
        Map<Long, List<RoadmapLesson>> lessonsByModule = roadmapLessonRepository
                .findByModuleCareerPathIdOrderByOrderIndexAsc(path.getId())
                .stream()
                .collect(Collectors.groupingBy(l -> l.getModule().getId()));

        List<LearningDtos.ModuleDto> moduleDtos = modules.stream().map(module -> {
            List<RoadmapLesson> lessons = lessonsByModule.getOrDefault(module.getId(), List.of());
            return new LearningDtos.ModuleDto(
                    module.getId(),
                    module.getTitle(),
                    module.getDescription(),
                    module.getOrderIndex(),
                    module.getEstimatedWeeks(),
                    0,
                    lessons.size(),
                    false,
                    lessons.stream()
                            .map(l -> new LearningDtos.LessonDto(l.getId(), l.getTitle(),
                                    l.getDescription(), l.getAssignment(), l.getDurationMinutes(),
                                    l.getOrderIndex(), false))
                            .toList());
        }).toList();

        return new LearningDtos.CareerPathDetailDto(
                path.getId(), path.getName(), path.getSlug(), path.getDescription(),
                path.getDurationWeeks(), path.getDifficulty(),
                splitSkills(path.getSkills()), path.getIcon(),
                moduleDtos,
                roadmapProjectRepository.findByCareerPathIdOrderByOrderIndexAsc(path.getId()).stream()
                        .map(LearningDtos.ProjectDto::from).toList(),
                roadmapResourceRepository.findByCareerPathIdOrderByOrderIndexAsc(path.getId()).stream()
                        .map(LearningDtos.ResourceDto::from).toList(),
                roadmapSessionRepository.findByCareerPathIdOrderByOrderIndexAsc(path.getId()).stream()
                        .map(LearningDtos.SessionDto::from).toList());
    }

    /* ─────────────────────────── Learner roadmaps ─────────────────────────── */

    @Transactional(readOnly = true)
    public List<LearningDtos.LearnerRoadmapSummaryDto> listRoadmaps(User learner) {
        return learnerRoadmapRepository.findByLearnerIdOrderByCreatedAtDesc(learner.getId()).stream()
                .map(this::toSummary)
                .toList();
    }

    /** Returns the active roadmap detail, or {@code null} when the learner has none. */
    @Transactional(readOnly = true)
    public LearningDtos.LearnerRoadmapDetailDto getActiveRoadmap(User learner) {
        return learnerRoadmapRepository
                .findFirstByLearnerIdAndStatusOrderByUpdatedAtDesc(learner.getId(), RoadmapStatus.ACTIVE)
                .map(this::toDetail)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public LearningDtos.LearnerRoadmapDetailDto getRoadmap(User learner, Long roadmapId) {
        return toDetail(requireOwnedRoadmap(learner, roadmapId));
    }

    /**
     * Creates a new ACTIVE roadmap for the learner. If an ACTIVE roadmap already
     * exists it is archived (progress preserved) so only one stays ACTIVE.
     *
     * <p>The learner row is pessimistically locked so two concurrent create/switch
     * calls for the same learner can never both promote a roadmap to ACTIVE.
     */
    @Transactional
    public LearningDtos.LearnerRoadmapDetailDto createRoadmap(User learner, Long careerPathId) {
        User lockedLearner = requireLearnerForUpdate(learner);
        CareerPath path = requireCareerPath(careerPathId);
        OffsetDateTime now = OffsetDateTime.now();

        archiveActiveRoadmap(lockedLearner.getId(), now);

        LearnerRoadmap roadmap = new LearnerRoadmap();
        roadmap.setLearner(lockedLearner);
        roadmap.setCareerPath(path);
        roadmap.setStatus(RoadmapStatus.ACTIVE);
        roadmap.setProgressPercent(0);
        roadmap.setStartedAt(now);
        roadmap.setCreatedAt(now);
        roadmap.setUpdatedAt(now);
        LearnerRoadmap saved = learnerRoadmapRepository.save(roadmap);
        return toDetail(saved);
    }

    /**
     * Marks a lesson complete/incomplete and derives the roadmap progress from
     * the resulting completion set. Certificates are issued when milestones
     * (modules) or the whole roadmap are completed.
     */
    @Transactional
    public LearningDtos.LearnerRoadmapDetailDto toggleLesson(
            User learner, Long roadmapId, Long lessonId, boolean completed) {
        LearnerRoadmap roadmap = requireOwnedRoadmap(learner, roadmapId);

        RoadmapLesson lesson = roadmapLessonRepository.findById(lessonId)
                .orElseThrow(() -> new IllegalArgumentException("Lesson not found"));
        if (!lesson.getModule().getCareerPath().getId().equals(roadmap.getCareerPath().getId())) {
            throw new IllegalArgumentException("Lesson does not belong to this roadmap");
        }

        if (completed) {
            if (roadmapProgressRepository.findByLearnerRoadmapIdAndLessonId(roadmap.getId(), lessonId).isEmpty()) {
                RoadmapProgress progress = new RoadmapProgress();
                progress.setLearnerRoadmap(roadmap);
                progress.setLesson(lesson);
                progress.setCompletedAt(OffsetDateTime.now());
                roadmapProgressRepository.save(progress);
            }
        } else {
            roadmapProgressRepository.deleteByLearnerRoadmapIdAndLessonId(roadmap.getId(), lessonId);
        }

        List<RoadmapLesson> allLessons = roadmapLessonRepository
                .findByModuleCareerPathIdOrderByOrderIndexAsc(roadmap.getCareerPath().getId());
        Set<Long> completedLessonIds = roadmapProgressRepository.findByLearnerRoadmapId(roadmap.getId()).stream()
                .map(p -> p.getLesson().getId())
                .collect(Collectors.toSet());

        int total = allLessons.size();
        int completedCount = completedLessonIds.size();
        int progressPercent = total == 0 ? 0
                : (int) Math.round((completedCount * 100.0) / total);

        roadmap.setProgressPercent(progressPercent);
        OffsetDateTime now = OffsetDateTime.now();
        if (progressPercent >= 100 && total > 0) {
            if (roadmap.getCompletedAt() == null) {
                roadmap.setCompletedAt(now);
            }
        } else {
            roadmap.setCompletedAt(null);
        }
        roadmap.setUpdatedAt(now);
        learnerRoadmapRepository.save(roadmap);

        issueCertificates(roadmap, allLessons, completedLessonIds, now);
        return toDetail(roadmap);
    }

    /**
     * Changes a roadmap's lifecycle status. {@code switch} promotes a roadmap to
     * ACTIVE (archiving any other active one); {@code archive} puts it on hold.
     *
     * <p>Lifecycle transitions are serialized per learner via a pessimistic lock
     * on the learner row (see {@link #requireLearnerForUpdate}).
     */
    @Transactional
    public LearningDtos.LearnerRoadmapSummaryDto updateStatus(User learner, Long roadmapId, String action) {
        requireLearnerForUpdate(learner);
        LearnerRoadmap roadmap = requireOwnedRoadmap(learner, roadmapId);
        OffsetDateTime now = OffsetDateTime.now();

        if ("switch".equalsIgnoreCase(action)) {
            if (roadmap.getStatus() == RoadmapStatus.ACTIVE) {
                throw new IllegalArgumentException("This roadmap is already active");
            }
            archiveActiveRoadmap(learner.getId(), now);
            roadmap.setStatus(RoadmapStatus.ACTIVE);
            if (roadmap.getStartedAt() == null) {
                roadmap.setStartedAt(now);
            }
            roadmap.setUpdatedAt(now);
        } else if ("archive".equalsIgnoreCase(action)) {
            if (roadmap.getStatus() == RoadmapStatus.ARCHIVED) {
                throw new IllegalArgumentException("This roadmap is already archived");
            }
            roadmap.setStatus(RoadmapStatus.ARCHIVED);
            roadmap.setUpdatedAt(now);
        } else {
            throw new IllegalArgumentException("Invalid action — use 'switch' or 'archive'");
        }

        return toSummary(learnerRoadmapRepository.save(roadmap));
    }

    /** Deletes a roadmap — only allowed when it has never been started. */
    @Transactional
    public void deleteRoadmap(User learner, Long roadmapId) {
        LearnerRoadmap roadmap = requireOwnedRoadmap(learner, roadmapId);
        if (roadmap.getProgressPercent() != null && roadmap.getProgressPercent() > 0) {
            throw new IllegalArgumentException("Only roadmaps that have never been started can be deleted");
        }
        roadmapProgressRepository.deleteAll(
                roadmapProgressRepository.findByLearnerRoadmapId(roadmap.getId()));
        roadmapCertificateRepository.deleteAll(
                roadmapCertificateRepository.findByLearnerRoadmapIdOrderByIssuedAtDesc(roadmap.getId()));
        learnerRoadmapRepository.delete(roadmap);
    }

    /* ─────────────────────────── Internals ─────────────────────────── */

    /**
     * Locks the learner's user row (PESSIMISTIC_WRITE) so ACTIVE-promoting
     * lifecycle transitions are serialized per learner — the single-ACTIVE
     * invariant cannot be violated by concurrent requests.
     */
    private User requireLearnerForUpdate(User learner) {
        return userRepository.findByIdWithLock(learner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Learner not found"));
    }

    private CareerPath requireCareerPath(Long careerPathId) {
        CareerPath path = careerPathRepository.findById(careerPathId)
                .orElseThrow(() -> new IllegalArgumentException("Career path not found"));
        if (!path.isActive()) {
            throw new IllegalArgumentException("Career path not found");
        }
        return path;
    }

    private LearnerRoadmap requireOwnedRoadmap(User learner, Long roadmapId) {
        LearnerRoadmap roadmap = learnerRoadmapRepository.findById(roadmapId)
                .orElseThrow(() -> new IllegalArgumentException("Roadmap not found"));
        if (!roadmap.getLearner().getId().equals(learner.getId())) {
            throw new IllegalArgumentException("Roadmap not found");
        }
        return roadmap;
    }

    private void archiveActiveRoadmap(Long learnerId, OffsetDateTime now) {
        learnerRoadmapRepository
                .findFirstByLearnerIdAndStatusOrderByUpdatedAtDesc(learnerId, RoadmapStatus.ACTIVE)
                .ifPresent(active -> {
                    active.setStatus(RoadmapStatus.ARCHIVED);
                    active.setUpdatedAt(now);
                    learnerRoadmapRepository.save(active);
                });
    }

    private void issueCertificates(LearnerRoadmap roadmap, List<RoadmapLesson> allLessons,
            Set<Long> completedLessonIds, OffsetDateTime now) {
        Long careerPathId = roadmap.getCareerPath().getId();
        String slug = roadmap.getCareerPath().getSlug();

        Map<Long, List<RoadmapLesson>> lessonsByModule = allLessons.stream()
                .collect(Collectors.groupingBy(l -> l.getModule().getId()));

        for (RoadmapModule module : roadmapModuleRepository
                .findByCareerPathIdOrderByOrderIndexAsc(careerPathId)) {
            List<RoadmapLesson> moduleLessons = lessonsByModule.getOrDefault(module.getId(), List.of());
            if (moduleLessons.isEmpty()) {
                continue;
            }
            boolean moduleDone = moduleLessons.stream()
                    .allMatch(l -> completedLessonIds.contains(l.getId()));
            if (moduleDone) {
                String code = slug + "-MOD" + module.getId();
                if (!roadmapCertificateRepository.existsByLearnerRoadmapIdAndCode(roadmap.getId(), code)) {
                    saveCertificate(roadmap, roadmap.getCareerPath().getName() + " — " + module.getTitle(),
                            code, now);
                }
            }
        }

        boolean roadmapDone = !allLessons.isEmpty()
                && allLessons.stream().allMatch(l -> completedLessonIds.contains(l.getId()));
        if (roadmapDone) {
            String code = slug + "-COMPLETE";
            if (!roadmapCertificateRepository.existsByLearnerRoadmapIdAndCode(roadmap.getId(), code)) {
                saveCertificate(roadmap, roadmap.getCareerPath().getName() + " — Completion", code, now);
            }
        }
    }

    private void saveCertificate(LearnerRoadmap roadmap, String title, String code, OffsetDateTime now) {
        RoadmapCertificate certificate = new RoadmapCertificate();
        certificate.setLearnerRoadmap(roadmap);
        certificate.setTitle(title);
        certificate.setCode(code);
        certificate.setIssuedAt(now);
        roadmapCertificateRepository.save(certificate);
    }

    private LearningDtos.LearnerRoadmapSummaryDto toSummary(LearnerRoadmap roadmap) {
        Set<Long> completedLessonIds = roadmapProgressRepository.findByLearnerRoadmapId(roadmap.getId()).stream()
                .map(p -> p.getLesson().getId())
                .collect(Collectors.toSet());
        int total = roadmapLessonRepository
                .findByModuleCareerPathIdOrderByOrderIndexAsc(roadmap.getCareerPath().getId()).size();
        return toSummary(roadmap, completedLessonIds.size(), total);
    }

    private LearningDtos.LearnerRoadmapSummaryDto toSummary(
            LearnerRoadmap roadmap, int completedCount, int total) {
        boolean canDelete = roadmap.getProgressPercent() == null || roadmap.getProgressPercent() == 0;
        return new LearningDtos.LearnerRoadmapSummaryDto(
                roadmap.getId(),
                roadmap.getStatus() == null ? RoadmapStatus.NOT_STARTED.name() : roadmap.getStatus().name(),
                roadmap.getProgressPercent(),
                completedCount,
                total,
                canDelete,
                roadmap.getCreatedAt(),
                roadmap.getUpdatedAt(),
                roadmap.getStartedAt(),
                roadmap.getCompletedAt(),
                LearningDtos.CareerPathSummaryDto.from(roadmap.getCareerPath()));
    }

    private LearningDtos.LearnerRoadmapDetailDto toDetail(LearnerRoadmap roadmap) {
        CareerPath path = roadmap.getCareerPath();
        List<RoadmapLesson> allLessons = roadmapLessonRepository
                .findByModuleCareerPathIdOrderByOrderIndexAsc(path.getId());
        Set<Long> completedLessonIds = roadmapProgressRepository.findByLearnerRoadmapId(roadmap.getId()).stream()
                .map(p -> p.getLesson().getId())
                .collect(Collectors.toSet());

        Map<Long, List<RoadmapLesson>> lessonsByModule = allLessons.stream()
                .collect(Collectors.groupingBy(l -> l.getModule().getId()));

        List<LearningDtos.ModuleDto> moduleDtos = roadmapModuleRepository
                .findByCareerPathIdOrderByOrderIndexAsc(path.getId())
                .stream()
                .map(module -> {
                    List<RoadmapLesson> lessons = lessonsByModule.getOrDefault(module.getId(), List.of());
                    int done = (int) lessons.stream()
                            .filter(l -> completedLessonIds.contains(l.getId()))
                            .count();
                    List<LearningDtos.LessonDto> lessonDtos = lessons.stream()
                            .map(l -> new LearningDtos.LessonDto(l.getId(), l.getTitle(),
                                    l.getDescription(), l.getAssignment(), l.getDurationMinutes(),
                                    l.getOrderIndex(), completedLessonIds.contains(l.getId())))
                            .toList();
                    return new LearningDtos.ModuleDto(
                            module.getId(), module.getTitle(), module.getDescription(),
                            module.getOrderIndex(), module.getEstimatedWeeks(),
                            done, lessons.size(),
                            !lessons.isEmpty() && done == lessons.size(),
                            lessonDtos);
                })
                .toList();

        List<LearningDtos.CertificateDto> certificates = roadmapCertificateRepository
                .findByLearnerRoadmapIdOrderByIssuedAtDesc(roadmap.getId()).stream()
                .map(LearningDtos.CertificateDto::from)
                .toList();

        int total = allLessons.size();
        int completedCount = completedLessonIds.size();

        LearningDtos.LearnerRoadmapSummaryDto summary = toSummary(roadmap, completedCount, total);
        return new LearningDtos.LearnerRoadmapDetailDto(
                summary.id(), summary.status(), summary.progressPercent(),
                summary.completedLessons(), summary.totalLessons(), summary.canDelete(),
                summary.createdAt(), summary.updatedAt(), summary.startedAt(), summary.completedAt(),
                summary.careerPath(),
                moduleDtos,
                roadmapProjectRepository.findByCareerPathIdOrderByOrderIndexAsc(path.getId()).stream()
                        .map(LearningDtos.ProjectDto::from).toList(),
                roadmapResourceRepository.findByCareerPathIdOrderByOrderIndexAsc(path.getId()).stream()
                        .map(LearningDtos.ResourceDto::from).toList(),
                roadmapSessionRepository.findByCareerPathIdOrderByOrderIndexAsc(path.getId()).stream()
                        .map(LearningDtos.SessionDto::from).toList(),
                certificates);
    }

    private List<String> splitSkills(String skills) {
        if (skills == null || skills.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(skills.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
