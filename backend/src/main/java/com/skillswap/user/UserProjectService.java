package com.skillswap.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Service implementing user project business logic.
 */
@Service
@RequiredArgsConstructor
public class UserProjectService {

    private final UserProjectRepository userProjectRepository;

    @Transactional(readOnly = true)
    public List<UserProjectDto> listProjects(User user) {
        return userProjectRepository.findByUserId(user.getId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public UserProjectDto createProject(User user, UserProjectDto request) {
        validateProjectDates(request);

        UserProject project = new UserProject();
        project.setUser(user);
        project.setTitle(trimToNull(request.getTitle()));
        project.setDescription(trimToNull(request.getDescription()));
        project.setTechnologies(trimToNull(request.getTechnologies()));
        project.setGithubUrl(trimToNull(request.getGithubUrl()));
        project.setLiveDemoUrl(trimToNull(request.getLiveDemoUrl()));
        project.setRole(trimToNull(request.getRole()));
        project.setImageUrls(trimToNull(request.getImageUrls()));
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.isCurrentlyWorking() ? null : request.getEndDate());
        project.setCurrentlyWorking(request.isCurrentlyWorking());

        return toDto(userProjectRepository.save(project));
    }

    @Transactional
    public UserProjectDto updateProject(User user, Long projectId, UserProjectDto request) {
        validateProjectDates(request);

        UserProject project = userProjectRepository.findById(projectId)
                .filter(item -> item.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));

        project.setTitle(trimToNull(request.getTitle()));
        project.setDescription(trimToNull(request.getDescription()));
        project.setTechnologies(trimToNull(request.getTechnologies()));
        project.setGithubUrl(trimToNull(request.getGithubUrl()));
        project.setLiveDemoUrl(trimToNull(request.getLiveDemoUrl()));
        project.setRole(trimToNull(request.getRole()));
        project.setImageUrls(trimToNull(request.getImageUrls()));
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.isCurrentlyWorking() ? null : request.getEndDate());
        project.setCurrentlyWorking(request.isCurrentlyWorking());

        return toDto(userProjectRepository.save(project));
    }

    @Transactional
    public void deleteProject(User user, Long projectId) {
        UserProject project = userProjectRepository.findById(projectId)
                .filter(item -> item.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));

        userProjectRepository.delete(project);
    }

    private UserProjectDto toDto(UserProject project) {
        UserProjectDto dto = new UserProjectDto();
        dto.setId(project.getId());
        dto.setTitle(project.getTitle());
        dto.setDescription(project.getDescription());
        dto.setTechnologies(project.getTechnologies());
        dto.setGithubUrl(project.getGithubUrl());
        dto.setLiveDemoUrl(project.getLiveDemoUrl());
        dto.setRole(project.getRole());
        dto.setImageUrls(project.getImageUrls());
        dto.setStartDate(project.getStartDate());
        dto.setEndDate(project.getEndDate());
        dto.setCurrentlyWorking(project.isCurrentlyWorking());
        return dto;
    }

    private static void validateProjectDates(UserProjectDto request) {
        LocalDate startDate = request.getStartDate();

        if (startDate == null) {
            throw new IllegalArgumentException("Project start date is required");
        }

        if (!request.isCurrentlyWorking() && request.getEndDate() != null
                && request.getEndDate().isBefore(startDate)) {
            throw new IllegalArgumentException("Project end date cannot be before start date");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
