package com.skillswap.admin;

import com.skillswap.common.ApiResponse;
import com.skillswap.safety.ReportStatus;
import com.skillswap.safety.UserReport;
import com.skillswap.safety.UserReportRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import com.skillswap.verification.MentorVerificationRequest;
import com.skillswap.verification.MentorVerificationRequestRepository;
import com.skillswap.verification.MentorVerificationRequestStatus;
import com.skillswap.wallet.WalletLedgerEntry;
import com.skillswap.wallet.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final UserReportRepository reportRepository;
    private final MentorVerificationRequestRepository mentorVerificationRepository;
    private final WalletService walletService;

    @GetMapping("/summary")
    public ApiResponse<AdminSummary> summary(@AuthenticationPrincipal User currentUser) {
        ensureAdmin(currentUser);

        long totalUsers = userRepository.count();
        long learners = userRepository.findByRole(UserRole.LEARNER).size();
        long mentors = userRepository.findByRole(UserRole.MENTOR).size();
        long admins = userRepository.findByRole(UserRole.ADMIN).size();
        long openReports = reportRepository.findByStatusOrderByCreatedAtAsc(ReportStatus.OPEN).size();
        long pendingMentorVerifications = mentorVerificationRepository
                .findByStatusOrderByCreatedAtAsc(MentorVerificationRequestStatus.PENDING)
                .size();

        return new ApiResponse<>("Admin summary fetched",
                new AdminSummary(totalUsers, learners, mentors, admins, openReports, pendingMentorVerifications));
    }

    @GetMapping("/reports")
    public ApiResponse<List<UserReport>> reports(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "OPEN") ReportStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Reports fetched", reportRepository.findByStatusOrderByCreatedAtAsc(status));
    }

    @PatchMapping("/reports/{id}")
    public ApiResponse<UserReport> updateReport(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody ReportDecisionRequest request) {
        ensureAdmin(currentUser);

        UserReport report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        report.setStatus(request.status());
        report.setUpdatedAt(OffsetDateTime.now());
        return new ApiResponse<>("Report updated", reportRepository.save(report));
    }

    @GetMapping("/mentor-verifications")
    public ApiResponse<List<MentorVerificationRequest>> mentorVerifications(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "PENDING") MentorVerificationRequestStatus status) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Mentor verification queue fetched",
                mentorVerificationRepository.findByStatusOrderByCreatedAtAsc(status));
    }

    @PatchMapping("/users/{id}/enabled")
    public ApiResponse<User> setUserEnabled(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody UserEnabledRequest request) {
        ensureAdmin(currentUser);

        if (currentUser.getId().equals(id)) {
            throw new IllegalArgumentException("Admins cannot disable their own account");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setEnabled(request.enabled());
        return new ApiResponse<>("User status updated", userRepository.save(user));
    }

    @PostMapping("/users/{id}/wallet-ledger")
    public ApiResponse<WalletLedgerEntry> createWalletLedgerEntry(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestBody WalletService.WalletEntryRequest request) {
        ensureAdmin(currentUser);
        return new ApiResponse<>("Wallet ledger entry created", walletService.addEntryForUser(id, request));
    }

    private static void ensureAdmin(User currentUser) {
        if (currentUser == null || currentUser.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only admins can access this area");
        }
    }

    public record AdminSummary(
            long totalUsers,
            long learners,
            long mentors,
            long admins,
            long openReports,
            long pendingMentorVerifications) {
    }

    public record ReportDecisionRequest(ReportStatus status) {
    }

    public record UserEnabledRequest(boolean enabled) {
    }
}
