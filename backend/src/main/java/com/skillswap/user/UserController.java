package com.skillswap.user;

import com.skillswap.common.ApiResponse;
import com.skillswap.referral.ReferralRewardRepository;
import com.skillswap.notification.NotificationService;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.session.SessionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Slf4j
public class UserController {

    private final UserRepository userRepository;
    private final MentorReviewRepository mentorReviewRepository;
    private final SessionRepository sessionRepository;
    private final ReferralRewardRepository referralRewardRepository;
    private final NotificationService notificationService;

    @GetMapping("/me")
    public ApiResponse<UserProfileResponse> me(@AuthenticationPrincipal User user) {
        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);
        return new ApiResponse<>("Current user", UserProfileResponse.from(user));
    }

    @PostMapping("/me/ping")
    public ApiResponse<String> ping(@AuthenticationPrincipal User user) {
        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);
        return new ApiResponse<>("Activity updated", "ok");
    }

    @GetMapping("/mentors")
    public ApiResponse<List<LiveMentorResponse>> mentors(
            @RequestParam(required = false) String skill) {
        OffsetDateTime now = OffsetDateTime.now();
        String normalizedSkill = skill == null ? "" : skill.trim();

        List<User> mentorUsers = normalizedSkill.isEmpty()
                ? userRepository.findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole.MENTOR)
                : userRepository.findByRoleAndEnabledTrueAndSkillsContainingIgnoreCaseOrderByLastActiveAtDesc(
                        UserRole.MENTOR,
                        normalizedSkill);

        List<LiveMentorResponse> mentors = mentorUsers
                .stream()
                .map(mentor -> {
                    double averageRating = mentorReviewRepository.averageRatingByMentorId(mentor.getId());
                    long totalReviews = mentorReviewRepository.countByMentorId(mentor.getId());
                    boolean liveNow = mentor.getLastActiveAt() != null
                            && mentor.getLastActiveAt().isAfter(now.minusMinutes(5));
                    return LiveMentorResponse.from(
                            mentor,
                            Math.round(averageRating * 10.0) / 10.0,
                            totalReviews,
                            liveNow);
                })
                .toList();

        return new ApiResponse<>("Mentors fetched", mentors);
    }

    @GetMapping("/mentors/skills")
    public ApiResponse<List<String>> mentorSkills() {
        List<User> mentors = userRepository.findByRoleAndEnabledTrueOrderByLastActiveAtDesc(UserRole.MENTOR);
        Set<String> skills = new LinkedHashSet<>();
        for (User mentor : mentors) {
            skills.addAll(extractSkillNames(mentor.getSkills()));
        }
        return new ApiResponse<>("Mentor skills fetched", new ArrayList<>(skills));
    }

    @GetMapping("/mentors/live")
    public ApiResponse<java.util.List<LiveMentorResponse>> liveMentors(
            @RequestParam(defaultValue = "24") int recentHours) {
        int safeRecentHours = Math.max(1, Math.min(168, recentHours));
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime cutoff = now.minusHours(safeRecentHours);

        java.util.List<LiveMentorResponse> mentors = userRepository
                .findByRoleAndEnabledTrueAndLastActiveAtAfterOrderByLastActiveAtDesc(UserRole.MENTOR, cutoff)
                .stream()
                .map(mentor -> {
                    double averageRating = mentorReviewRepository.averageRatingByMentorId(mentor.getId());
                    long totalReviews = mentorReviewRepository.countByMentorId(mentor.getId());
                    boolean liveNow = mentor.getLastActiveAt() != null
                            && mentor.getLastActiveAt().isAfter(now.minusMinutes(5));
                    return LiveMentorResponse.from(
                            mentor,
                            Math.round(averageRating * 10.0) / 10.0,
                            totalReviews,
                            liveNow);
                })
                .toList();

        return new ApiResponse<>("Live mentors fetched", mentors);
    }

    @GetMapping("/mentors/{mentorId}")
    public ApiResponse<PublicMentorProfileResponse> mentorPublicProfile(@PathVariable Long mentorId) {
        User mentor = userRepository.findById(mentorId)
                .filter(user -> user.getRole() == UserRole.MENTOR)
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));

        double averageRating = mentorReviewRepository.averageRatingByMentorId(mentorId);
        long totalReviews = mentorReviewRepository.countByMentorId(mentorId);
        int upcomingSessions = sessionRepository
                .findByMentorIdAndStartTimeAfterOrderByStartTimeAsc(mentorId, OffsetDateTime.now())
                .size();

        return new ApiResponse<>(
                "Mentor profile fetched",
                PublicMentorProfileResponse.from(mentor, averageRating, totalReviews, upcomingSessions));
    }

    @PutMapping("/me/wallet")
    public ApiResponse<UserProfileResponse> updateWallet(@AuthenticationPrincipal User user,
            @RequestBody WalletUpdateRequest req) {
        user.setWalletAddress(req.walletAddress());
        userRepository.save(user);
        return new ApiResponse<>("Wallet updated", UserProfileResponse.from(user));
    }

    @GetMapping("/me/referral")
    public ApiResponse<ReferralSummaryResponse> referralSummary(@AuthenticationPrincipal User currentUser) {
        long totalReferrals = userRepository.countByReferredByUserId(currentUser.getId());
        int totalCreditsEarned = Math.toIntExact(referralRewardRepository.countByReferrerId(currentUser.getId()) * 50L);
        return new ApiResponse<>("Referral summary fetched",
                new ReferralSummaryResponse(currentUser.getReferralCode(), (int) totalReferrals, totalCreditsEarned));
    }

    @PutMapping("/me/profile")
    public ApiResponse<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UserProfileUpdateRequest req) {
        if (req.skills() != null) {
            user.setSkills(trimToNull(req.skills()));
        }
        if (req.aboutMe() != null) {
            user.setAboutMe(trimToNull(req.aboutMe()));
        }
        if (req.githubUrl() != null) {
            user.setGithubUrl(normalizeHttpUrl(req.githubUrl()));
        }
        if (req.linkedinUrl() != null) {
            user.setLinkedinUrl(normalizeHttpUrl(req.linkedinUrl()));
        }
        if (req.profileImageUrl() != null) {
            user.setProfileImageUrl(normalizeHttpUrl(req.profileImageUrl()));
        }
        if (req.projects() != null) {
            user.setProjects(trimToNull(req.projects()));
        }
        if (req.certificates() != null) {
            user.setCertificates(trimToNull(req.certificates()));
        }
        if (req.pastTeachingSessions() != null) {
            user.setPastTeachingSessions(trimToNull(req.pastTeachingSessions()));
        }
        userRepository.save(user);
        return new ApiResponse<>("Profile updated", UserProfileResponse.from(user));
    }

    @PutMapping("/me/role")
    public ApiResponse<UserProfileResponse> updateRole(
            @AuthenticationPrincipal User user,
            @RequestBody RoleUpdateRequest req) {
        if (req.role() == null) {
            throw new IllegalArgumentException("Role is required");
        }
        if (req.role() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Cannot self-upgrade to admin");
        }
        if (user.getRole() == req.role()) {
            return new ApiResponse<>("Role unchanged", UserProfileResponse.from(user));
        }

        UserRole previousRole = user.getRole();
        user.setRole(req.role());
        if (req.role() != UserRole.MENTOR) {
            user.setMentorVerified(false);
        }
        userRepository.save(user);

        notificationService.notifyUser(
                user.getId(),
                "ROLE_SWITCHED",
                "Role updated",
                "Your role changed from " + previousRole.name() + " to " + req.role().name(),
                user.getId());

        log.info("audit_role_changed userId={} previousRole={} newRole={}",
                user.getId(), previousRole.name(), req.role().name());

        return new ApiResponse<>("Role updated", UserProfileResponse.from(user));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeHttpUrl(String url) {
        String normalized = trimToNull(url);
        if (normalized == null) {
            return null;
        }
        String lowerCase = normalized.toLowerCase();
        if (!lowerCase.startsWith("http://") && !lowerCase.startsWith("https://")) {
            throw new IllegalArgumentException("Social links must start with http:// or https://");
        }
        return normalized;
    }

    private static List<String> extractSkillNames(String rawSkills) {
        String value = rawSkills == null ? "" : rawSkills.trim();
        if (value.isEmpty()) {
            return List.of();
        }

        List<String> skills = new ArrayList<>();

        if (value.startsWith("[") && value.endsWith("]")) {
            String compact = value.replace("\n", " ");
            String[] chunks = compact.split("\\{");
            for (String chunk : chunks) {
                int idx = chunk.indexOf("\"name\"");
                if (idx < 0) {
                    continue;
                }
                int colon = chunk.indexOf(':', idx);
                int firstQuote = chunk.indexOf('"', colon + 1);
                int secondQuote = chunk.indexOf('"', firstQuote + 1);
                if (colon > -1 && firstQuote > -1 && secondQuote > firstQuote) {
                    String name = chunk.substring(firstQuote + 1, secondQuote).trim();
                    if (!name.isEmpty()) {
                        skills.add(name);
                    }
                }
            }
            if (!skills.isEmpty()) {
                return skills.stream().distinct().toList();
            }
        }

        return java.util.Arrays.stream(value.split("[\\n,;|]+"))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .distinct()
                .toList();
    }

    public record WalletUpdateRequest(String walletAddress) {
    }

    public record RoleUpdateRequest(UserRole role) {
    }

    public record UserProfileUpdateRequest(
            @Size(max = 500) String skills,
            @Size(max = 2000) String aboutMe,
            @Size(max = 500) String githubUrl,
            @Size(max = 500) String linkedinUrl,
            @Size(max = 1000) String profileImageUrl,
            @Size(max = 6000) String projects,
            @Size(max = 6000) String certificates,
            @Size(max = 6000) String pastTeachingSessions) {
    }

    public record UserProfileResponse(
            Long id,
            String email,
            String fullName,
            String role,
            String walletAddress,
            String skills,
            String aboutMe,
            String githubUrl,
            String linkedinUrl,
            String profileImageUrl,
            String projects,
            String certificates,
            String pastTeachingSessions,
            Boolean mentorVerified,
            String verifiedSkills) {
        static UserProfileResponse from(User user) {
            return new UserProfileResponse(
                    user.getId(),
                    user.getEmail(),
                    user.getFullName(),
                    user.getRole().name(),
                    user.getWalletAddress(),
                    user.getSkills(),
                    user.getAboutMe(),
                    user.getGithubUrl(),
                    user.getLinkedinUrl(),
                    user.getProfileImageUrl(),
                    user.getProjects(),
                    user.getCertificates(),
                    user.getPastTeachingSessions(),
                    user.isMentorVerified(),
                    user.getVerifiedSkills());
        }
    }

    public record PublicMentorProfileResponse(
            Long id,
            String fullName,
            String skills,
            String aboutMe,
            String githubUrl,
            String linkedinUrl,
            String profileImageUrl,
            String projects,
            String certificates,
            String pastTeachingSessions,
            Boolean mentorVerified,
            String verifiedSkills,
            Double averageRating,
            Long totalReviews,
            Integer upcomingSessions) {
        static PublicMentorProfileResponse from(
                User mentor,
                double averageRating,
                long totalReviews,
                int upcomingSessions) {
            return new PublicMentorProfileResponse(
                    mentor.getId(),
                    mentor.getFullName(),
                    mentor.getSkills(),
                    mentor.getAboutMe(),
                    mentor.getGithubUrl(),
                    mentor.getLinkedinUrl(),
                    mentor.getProfileImageUrl(),
                    mentor.getProjects(),
                    mentor.getCertificates(),
                    mentor.getPastTeachingSessions(),
                    mentor.isMentorVerified(),
                    mentor.getVerifiedSkills(),
                    Math.round(averageRating * 10.0) / 10.0,
                    totalReviews,
                    upcomingSessions);
        }
    }

    public record LiveMentorResponse(
            Long id,
            String fullName,
            String skills,
            String profileImageUrl,
            Double averageRating,
            Long totalReviews,
            String lastActiveAt,
            Boolean liveNow) {
        static LiveMentorResponse from(
                User mentor,
                double averageRating,
                long totalReviews,
                boolean liveNow) {
            return new LiveMentorResponse(
                    mentor.getId(),
                    mentor.getFullName(),
                    mentor.getSkills(),
                    mentor.getProfileImageUrl(),
                    averageRating,
                    totalReviews,
                    mentor.getLastActiveAt() == null ? null : mentor.getLastActiveAt().toString(),
                    liveNow);
        }
    }

    public record ReferralSummaryResponse(
            String referralCode,
            int totalReferrals,
            int totalCreditsEarned) {
    }
}
