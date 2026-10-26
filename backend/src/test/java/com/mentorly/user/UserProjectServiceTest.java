package com.mentorly.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Regression tests for project link validation.
 *
 * <p>{@code githubUrl} and {@code liveDemoUrl} used to be stored verbatim and
 * are rendered as anchors on the public mentor profile, in the projects
 * manager and on the admin verification queue — a stored {@code javascript:}
 * URL would execute in the reader's origin on click. All three write paths now
 * go through {@link com.mentorly.common.HttpUrls#requireHttpUrl(String)}.
 */
@ExtendWith(MockitoExtension.class)
class UserProjectServiceTest {

    @Mock
    private UserProjectRepository userProjectRepository;

    @InjectMocks
    private UserProjectService userProjectService;

    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(7L);
    }

    private UserProjectDto baseRequest() {
        UserProjectDto dto = new UserProjectDto();
        dto.setTitle("Mentorly clone");
        dto.setDescription("A mentoring marketplace built for practice.");
        dto.setTechnologies("React,Spring Boot");
        dto.setStartDate(LocalDate.of(2026, 1, 1));
        dto.setCurrentlyWorking(true);
        return dto;
    }

    @Test
    void createProjectRejectsJavascriptGithubUrl() {
        UserProjectDto request = baseRequest();
        request.setGithubUrl("javascript:alert(document.cookie)");

        assertThrows(IllegalArgumentException.class,
                () -> userProjectService.createProject(owner, request));
        verify(userProjectRepository, never()).save(any());
    }

    @Test
    void createProjectRejectsNonHttpLiveDemoUrl() {
        UserProjectDto request = baseRequest();
        request.setLiveDemoUrl("data:text/html,<script>alert(1)</script>");

        assertThrows(IllegalArgumentException.class,
                () -> userProjectService.createProject(owner, request));
        verify(userProjectRepository, never()).save(any());
    }

    @Test
    void createProjectStoresHttpUrlsAndBlankAsNull() {
        UserProjectDto request = baseRequest();
        request.setGithubUrl("  https://github.com/nakulsharma97/mentorly  ");
        request.setLiveDemoUrl("   ");
        when(userProjectRepository.save(any(UserProject.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UserProjectDto saved = userProjectService.createProject(owner, request);

        assertEquals("https://github.com/nakulsharma97/mentorly", saved.getGithubUrl());
        assertNull(saved.getLiveDemoUrl(), "a blank link is stored as null, not an empty string");
    }

    @Test
    void updateProjectAlsoValidatesUrls() {
        UserProject existing = new UserProject();
        existing.setId(11L);
        existing.setUser(owner);
        when(userProjectRepository.findById(11L)).thenReturn(Optional.of(existing));
        when(userProjectRepository.save(any(UserProject.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UserProjectDto request = baseRequest();
        request.setGithubUrl("javascript:alert(2)");

        assertThrows(IllegalArgumentException.class,
                () -> userProjectService.updateProject(owner, 11L, request));

        // And the happy path still works on the same method.
        request.setGithubUrl("https://github.com/nakulsharma97/mentorly");
        UserProjectDto updated = userProjectService.updateProject(owner, 11L, request);
        assertTrue(updated.getGithubUrl().startsWith("https://"));
    }
}
