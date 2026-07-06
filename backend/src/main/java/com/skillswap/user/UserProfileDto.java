package com.skillswap.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserProfileDto {

    private String aboutMe;

    @Size(max = 500, message = "GitHub URL must be 500 characters or less")
    private String githubUrl;

    @Size(max = 500, message = "LinkedIn URL must be 500 characters or less")
    private String linkedinUrl;

    @Size(max = 1000, message = "Profile image URL must be 1000 characters or less")
    private String profileImageUrl;

    @Valid
    private List<UserProjectDto> projects;
}
