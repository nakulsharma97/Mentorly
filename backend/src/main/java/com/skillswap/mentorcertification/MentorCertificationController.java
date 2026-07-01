package com.skillswap.mentorcertification;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/mentor/certifications")
@RequiredArgsConstructor
@Slf4j
public class MentorCertificationController {

    private final MentorCertificationService certificationService;

    @GetMapping
    public ApiResponse<List<MentorCertificationDto>> listMyCertifications(@AuthenticationPrincipal User user) {
        return new ApiResponse<>("Certifications fetched", certificationService.listForMentor(user.getId()));
    }

    @GetMapping("/{mentorId}")
    public ApiResponse<List<MentorCertificationDto>> listCertifications(@PathVariable Long mentorId) {
        return new ApiResponse<>("Certifications fetched", certificationService.listForMentor(mentorId));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<MentorCertificationDto> createCertification(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody MentorCertificationDto request) {
        log.info("createCertification mentorId={}", user.getId());
        return new ApiResponse<>("Certification created", certificationService.create(user, request));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MentorCertificationDto> createCertificationMultipart(
            @AuthenticationPrincipal User user,
            @RequestParam String certificationName,
            @RequestParam String issuingOrganization,
            @RequestParam(required = false) String credentialId,
            @RequestParam String issueDate,
            @RequestParam(required = false) String expiryDate,
            @RequestParam(required = false) String certificateUrl,
            @RequestParam(required = false) String verificationUrl,
            @RequestParam(required = false) String description,
            @RequestPart(value = "certificateImage", required = false) MultipartFile certificateImage) {
        MentorCertificationDto request = new MentorCertificationDto();
        request.setCertificationName(certificationName);
        request.setIssuingOrganization(issuingOrganization);
        request.setCredentialId(credentialId);
        request.setIssueDate(issueDate == null || issueDate.isBlank() ? null : LocalDateParser.parse(issueDate));
        request.setExpiryDate(expiryDate == null || expiryDate.isBlank() ? null : LocalDateParser.parse(expiryDate));
        request.setCertificateUrl(certificateUrl);
        request.setVerificationUrl(verificationUrl);
        request.setDescription(description);
        request.setCertificateImage(storeCertificateImage(certificateImage));
        return new ApiResponse<>("Certification created", certificationService.create(user, request));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<MentorCertificationDto> updateCertification(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody MentorCertificationDto request) {
        log.info("updateCertification mentorId={} certificationId={}", user.getId(), id);
        return new ApiResponse<>("Certification updated", certificationService.update(user, id, request));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MentorCertificationDto> updateCertificationMultipart(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestParam String certificationName,
            @RequestParam String issuingOrganization,
            @RequestParam(required = false) String credentialId,
            @RequestParam String issueDate,
            @RequestParam(required = false) String expiryDate,
            @RequestParam(required = false) String certificateUrl,
            @RequestParam(required = false) String verificationUrl,
            @RequestParam(required = false) String description,
            @RequestPart(value = "certificateImage", required = false) MultipartFile certificateImage) {
        MentorCertificationDto request = new MentorCertificationDto();
        request.setCertificationName(certificationName);
        request.setIssuingOrganization(issuingOrganization);
        request.setCredentialId(credentialId);
        request.setIssueDate(issueDate == null || issueDate.isBlank() ? null : LocalDateParser.parse(issueDate));
        request.setExpiryDate(expiryDate == null || expiryDate.isBlank() ? null : LocalDateParser.parse(expiryDate));
        request.setCertificateUrl(certificateUrl);
        request.setVerificationUrl(verificationUrl);
        request.setDescription(description);
        request.setCertificateImage(storeCertificateImage(certificateImage));
        return new ApiResponse<>("Certification updated", certificationService.update(user, id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> deleteCertification(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        log.info("deleteCertification mentorId={} certificationId={}", user.getId(), id);
        certificationService.delete(user, id);
        return new ApiResponse<>("Certification deleted", "ok");
    }

    private String storeCertificateImage(MultipartFile certificateImage) {
        if (certificateImage == null || certificateImage.isEmpty()) {
            return null;
        }

        String originalFilename = certificateImage.getOriginalFilename() == null ? ""
                : certificateImage.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = certificateImage.getContentType() == null ? ""
                : certificateImage.getContentType().toLowerCase(Locale.ROOT);
        boolean allowed = contentType.equals("image/jpeg")
                || contentType.equals("image/png")
                || contentType.equals("application/pdf")
                || originalFilename.endsWith(".jpg")
                || originalFilename.endsWith(".jpeg")
                || originalFilename.endsWith(".png")
                || originalFilename.endsWith(".pdf");
        if (!allowed) {
            throw new IllegalArgumentException("Only PDF, JPG, and PNG files are allowed");
        }

        try {
            Path uploadDir = Paths.get("uploads", "certificates");
            Files.createDirectories(uploadDir);
            String extension = originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                    : ".bin";
            String storedName = UUID.randomUUID() + extension;
            Path target = uploadDir.resolve(storedName);
            try (InputStream inputStream = certificateImage.getInputStream()) {
                Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return "/uploads/certificates/" + storedName;
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not upload certificate image", ex);
        }
    }

    static final class LocalDateParser {
        private LocalDateParser() {
        }

        static java.time.LocalDate parse(String value) {
            return java.time.LocalDate.parse(value);
        }
    }
}
