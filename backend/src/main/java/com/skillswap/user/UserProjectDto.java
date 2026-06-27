package com.skillswap.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UserProjectDto {

    private Long id;

    @NotBlank(message = "Project title is required")
    private String title;

    @NotBlank(message = "Project description is required")
    private String description;

    @NotBlank(message = "Project technologies are required")
    private String technologies;

    private String githubUrl;

    private String liveDemoUrl;

    @NotNull(message = "Project start date is required")
    private LocalDate startDate;

    private LocalDate endDate;

    private boolean currentlyWorking;
}
