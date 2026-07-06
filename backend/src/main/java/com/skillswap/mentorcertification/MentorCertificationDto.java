package com.skillswap.mentorcertification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
public class MentorCertificationDto {

    private Long id;

    private Long mentorId;

    @NotBlank(message = "Certification name is required")
    private String certificationName;

    @NotBlank(message = "Issuing organization is required")
    private String issuingOrganization;

    private String credentialId;

    @NotNull(message = "Issue date is required")
    private LocalDate issueDate;

    private LocalDate expiryDate;

    private String certificateUrl;

    private String verificationUrl;

    private String certificateImage;

    private String description;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
