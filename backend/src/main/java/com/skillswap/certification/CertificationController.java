package com.skillswap.certification;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ApiResponse<Page<CertificationItem>> myCertifications(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<CertificationItem> items = certificationService
                .listForUser(user.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(CertificationItem::from);
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
