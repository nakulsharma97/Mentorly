package com.skillswap.mentorcertification;

import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class MentorCertificationService {

    private final MentorCertificationRepository certificationRepository;

    @Transactional(readOnly = true)
    public List<MentorCertificationDto> listForMentor(Long mentorId) {
        return certificationRepository.findByMentorIdOrderByIssueDateDesc(mentorId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public MentorCertificationDto create(User owner, MentorCertificationDto request) {
        validate(request);
        ensureUnique(owner, request, null);

        MentorCertification certification = new MentorCertification();
        certification.setMentor(owner);
        applyFields(certification, request);

        return toDto(certificationRepository.save(certification));
    }

    @Transactional
    public MentorCertificationDto update(User owner, Long certificationId, MentorCertificationDto request) {
        validate(request);

        MentorCertification certification = certificationRepository.findById(certificationId)
                .filter(item -> item.getMentor().getId().equals(owner.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Certification not found"));

        ensureUnique(owner, request, certificationId);
        applyFields(certification, request);

        return toDto(certificationRepository.save(certification));
    }

    @Transactional
    public void delete(User owner, Long certificationId) {
        MentorCertification certification = certificationRepository.findById(certificationId)
                .filter(item -> item.getMentor().getId().equals(owner.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Certification not found"));

        certificationRepository.delete(certification);
    }

    private void ensureUnique(User owner, MentorCertificationDto request, Long excludeId) {
        String normalizedName = normalize(request.getCertificationName());
        String normalizedOrg = normalize(request.getIssuingOrganization());
        if (normalizedName == null || normalizedOrg == null) return;

        boolean duplicate = certificationRepository.findByMentorIdOrderByIssueDateDesc(owner.getId())
                .stream()
                .anyMatch(item -> {
                    if (excludeId != null && excludeId.equals(item.getId())) return false;
                    return normalize(item.getCertificationName()).equals(normalizedName)
                            && normalize(item.getIssuingOrganization()).equals(normalizedOrg);
                });

        if (duplicate) {
            throw new IllegalArgumentException("A certification with the same name and organization already exists");
        }
    }

    private void applyFields(MentorCertification certification, MentorCertificationDto request) {
        certification.setCertificationName(trimToNull(request.getCertificationName()));
        certification.setIssuingOrganization(trimToNull(request.getIssuingOrganization()));
        certification.setCredentialId(trimToNull(request.getCredentialId()));
        certification.setCredentialUrl(trimToNull(request.getCredentialUrl()));
        certification.setIssueDate(request.getIssueDate());
        certification.setExpirationDate(request.isDoesNotExpire() ? null : request.getExpirationDate());
        certification.setDoesNotExpire(request.isDoesNotExpire());
        certification.setSkillsCovered(trimToNull(request.getSkillsCovered()));
        certification.setDescription(trimToNull(request.getDescription()));
        if (request.getCertificateImage() != null) {
            certification.setCertificateImage(trimToNull(request.getCertificateImage()));
        }
    }

    private MentorCertificationDto toDto(MentorCertification certification) {
        MentorCertificationDto dto = new MentorCertificationDto();
        dto.setId(certification.getId());
        dto.setMentorId(certification.getMentor() != null ? certification.getMentor().getId() : null);
        dto.setCertificationName(certification.getCertificationName());
        dto.setIssuingOrganization(certification.getIssuingOrganization());
        dto.setCredentialId(certification.getCredentialId());
        dto.setCredentialUrl(certification.getCredentialUrl());
        dto.setIssueDate(certification.getIssueDate());
        dto.setExpirationDate(certification.getExpirationDate());
        dto.setDoesNotExpire(certification.isDoesNotExpire());
        dto.setSkillsCovered(certification.getSkillsCovered());
        dto.setDescription(certification.getDescription());
        dto.setCertificateImage(certification.getCertificateImage());
        dto.setCreatedAt(certification.getCreatedAt());
        dto.setUpdatedAt(certification.getUpdatedAt());
        return dto;
    }

    private static void validate(MentorCertificationDto request) {
        if (request.getCertificationName() == null || request.getCertificationName().trim().isEmpty()) {
            throw new IllegalArgumentException("Certification name is required");
        }
        if (request.getIssuingOrganization() == null || request.getIssuingOrganization().trim().isEmpty()) {
            throw new IllegalArgumentException("Issuing organization is required");
        }
        if (request.getIssueDate() == null) {
            throw new IllegalArgumentException("Issue date is required");
        }
        if (!request.isDoesNotExpire() && request.getExpirationDate() != null
                && request.getExpirationDate().isBefore(request.getIssueDate())) {
            throw new IllegalArgumentException("Expiration date must be after the issue date");
        }
        // Validate credential URL format if provided
        if (request.getCredentialUrl() != null && !request.getCredentialUrl().trim().isEmpty()) {
            String url = request.getCredentialUrl().trim().toLowerCase(Locale.ROOT);
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                throw new IllegalArgumentException("Credential URL must start with http:// or https://");
            }
        }
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
