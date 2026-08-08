package com.skillswap.learning;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * Immutable DTOs for the database-driven learning system. Entities are never
 * serialized directly — DTOs avoid lazy-loading errors and leaking internal
 * details while giving the UI exactly the shape it needs.
 */
public final class LearningDtos {

    private LearningDtos() {
    }

    public record CareerPathSummaryDto(
            Long id,
            String name,
            String slug,
            String description,
            Integer durationWeeks,
            String difficulty,
            List<String> skills,
            String icon) {

        static CareerPathSummaryDto from(CareerPath path) {
            List<String> skillList = path.getSkills() == null || path.getSkills().isBlank()
                    ? List.of()
                    : Arrays.stream(path.getSkills().split(","))
                            .map(String::trim)
                            .filter(s -> !s.isEmpty())
                            .toList();
            return new CareerPathSummaryDto(
                    path.getId(),
                    path.getName(),
                    path.getSlug(),
                    path.getDescription(),
                    path.getDurationWeeks(),
                    path.getDifficulty(),
                    skillList,
                    path.getIcon());
        }
    }

    public record LessonDto(
            Long id,
            String title,
            String description,
            String assignment,
            Integer durationMinutes,
            Integer orderIndex,
            boolean completed) {
    }

    public record ModuleDto(
            Long id,
            String title,
            String description,
            Integer orderIndex,
            Integer estimatedWeeks,
            int completedLessons,
            int totalLessons,
            boolean completed,
            List<LessonDto> lessons) {
    }

    public record ProjectDto(
            Long id,
            String title,
            String description,
            String difficulty,
            Integer orderIndex) {

        static ProjectDto from(RoadmapProject project) {
            return new ProjectDto(project.getId(), project.getTitle(), project.getDescription(),
                    project.getDifficulty(), project.getOrderIndex());
        }
    }

    public record ResourceDto(
            Long id,
            String title,
            String url,
            String resourceType,
            Integer orderIndex) {

        static ResourceDto from(RoadmapResource resource) {
            return new ResourceDto(resource.getId(), resource.getTitle(), resource.getUrl(),
                    resource.getResourceType() == null ? "DOCUMENTATION" : resource.getResourceType().name(),
                    resource.getOrderIndex());
        }
    }

    public record SessionDto(
            Long id,
            String title,
            String description,
            Integer durationMinutes,
            Integer orderIndex) {

        static SessionDto from(RoadmapSession session) {
            return new SessionDto(session.getId(), session.getTitle(), session.getDescription(),
                    session.getDurationMinutes(), session.getOrderIndex());
        }
    }

    public record CertificateDto(
            Long id,
            String title,
            String code,
            OffsetDateTime issuedAt) {

        static CertificateDto from(RoadmapCertificate certificate) {
            return new CertificateDto(certificate.getId(), certificate.getTitle(),
                    certificate.getCode(), certificate.getIssuedAt());
        }
    }

    public record CareerPathDetailDto(
            Long id,
            String name,
            String slug,
            String description,
            Integer durationWeeks,
            String difficulty,
            List<String> skills,
            String icon,
            List<ModuleDto> modules,
            List<ProjectDto> projects,
            List<ResourceDto> resources,
            List<SessionDto> sessions) {
    }

    public record LearnerRoadmapSummaryDto(
            Long id,
            String status,
            Integer progressPercent,
            int completedLessons,
            int totalLessons,
            boolean canDelete,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OffsetDateTime startedAt,
            OffsetDateTime completedAt,
            CareerPathSummaryDto careerPath) {
    }

    public record LearnerRoadmapDetailDto(
            Long id,
            String status,
            Integer progressPercent,
            int completedLessons,
            int totalLessons,
            boolean canDelete,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OffsetDateTime startedAt,
            OffsetDateTime completedAt,
            CareerPathSummaryDto careerPath,
            List<ModuleDto> modules,
            List<ProjectDto> projects,
            List<ResourceDto> resources,
            List<SessionDto> sessions,
            List<CertificateDto> certificates) {
    }
}
