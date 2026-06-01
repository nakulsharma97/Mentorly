package com.skillswap.sessionpackage;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/session-packages")
@RequiredArgsConstructor
public class SessionPackageController {

    private final SessionPackageRepository sessionPackageRepository;

    @GetMapping
    public ApiResponse<List<SessionPackage>> list(@RequestParam(required = false) Long mentorId) {
        List<SessionPackage> packages = mentorId == null
                ? sessionPackageRepository.findAll()
                : sessionPackageRepository.findByMentorId(mentorId);
        return new ApiResponse<>("Session packages fetched", packages);
    }

    @PostMapping
    public ApiResponse<SessionPackage> create(
            @AuthenticationPrincipal User mentor,
            @RequestBody CreateSessionPackageRequest req) {
        SessionPackage sessionPackage = new SessionPackage();
        sessionPackage.setMentor(mentor);
        sessionPackage.setTitle(req.title());
        sessionPackage.setDescription(req.description());
        sessionPackage.setSessionCount(req.sessionCount());
        sessionPackage.setDiscountPercent(req.discountPercent());
        sessionPackage.setTotalPrice(req.totalPrice());
        sessionPackage.setActive(req.active() == null || req.active());

        return new ApiResponse<>("Session package created", sessionPackageRepository.save(sessionPackage));
    }

    public record CreateSessionPackageRequest(
            String title,
            String description,
            Integer sessionCount,
            BigDecimal discountPercent,
            BigDecimal totalPrice,
            Boolean active) {
    }
}
