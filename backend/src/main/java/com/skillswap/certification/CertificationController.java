package com.skillswap.certification;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * REST controller exposing certification endpoints.
 */
@RestController
@RequestMapping("/api/v1/certifications")
@RequiredArgsConstructor
public class CertificationController {

    private final CertificationService certificationService;

    @GetMapping("/me")
    public ApiResponse<List<CertificationItem>> myCertifications(@AuthenticationPrincipal User user) {
        List<CertificationItem> items = certificationService.listForUser(user.getId()).stream()
                .map(CertificationItem::from)
                .toList();
        return new ApiResponse<>("Certifications fetched", items);
    }

    @PostMapping("/evaluate")
    public ApiResponse<List<CertificationItem>> evaluate(@AuthenticationPrincipal User user) {
        List<CertificationItem> items = certificationService.evaluateAndAward(user).stream()
                .map(CertificationItem::from)
                .toList();
        return new ApiResponse<>("Certification evaluation completed", items);
    }

/**
 * Immutable data carrier for certification item.
 */
    public record CertificationItem(
            Long id,
            String code,
            String title,
            String description,
            OffsetDateTime issuedAt) {
        static CertificationItem from(UserCertification certification) {
            return new CertificationItem(
                    certification.getId(),
                    certification.getCode(),
                    certification.getTitle(),
                    certification.getDescription(),
                    certification.getIssuedAt());
        }
    }
}
