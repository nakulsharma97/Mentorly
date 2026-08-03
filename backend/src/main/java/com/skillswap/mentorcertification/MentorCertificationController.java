package com.skillswap.mentorcertification;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing mentor certification endpoints.
 */
@RestController
@RequestMapping("/api/v1/mentor/certifications")
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

    @PutMapping("/{id}")
    public ApiResponse<MentorCertificationDto> updateCertification(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody MentorCertificationDto request) {
        log.info("updateCertification mentorId={} certificationId={}", user.getId(), id);
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
}
