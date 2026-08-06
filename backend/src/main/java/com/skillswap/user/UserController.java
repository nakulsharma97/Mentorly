package com.skillswap.user;

import com.skillswap.common.ApiClientException;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.common.UsernameRules;
import com.skillswap.common.exception.BadRequestException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import com.skillswap.notification.NotificationService;
import com.skillswap.referral.ReferralRewardRepository;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.session.SessionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * REST controller exposing user endpoints.
 */
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
    private final ProfileCompletionGuard profileCompletionGuard;

    @GetMapping("/me")
    @Transactional
    public ApiResponse<UserProfileResponse> me(@AuthenticationPrincipal User user) {
        // Re-fetch the user within an active transaction to avoid
        // LazyInitializationException when computeProfileCompletion()
        // inspects profile fields (e.g. projects stored as TEXT).
        // The @AuthenticationPrincipal User is loaded in the JWT filter
        // without an active Hibernate session, so lazy associations are
        // uninitialized. By re-fetching here under @Transactional,
        // we get a fully managed entity with all fields safely accessible.
        User managedUser = userRepository.findById(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        // Lightweight last-active timestamp update via direct query
        // to avoid cascading operations on lazy collections like projectsList.
        userRepository.updateLastActiveAt(managedUser.getEmail(), OffsetDateTime.now());
        return new ApiResponse<>("Current user", UserProfileResponse.from(managedUser));
    }

    @PostMapping("/me/ping")
    @Transactional
    public ApiResponse<String> ping(@AuthenticationPrincipal User user) {
        // Use a direct UPDATE query to avoid cascading operations on
        // lazy-loaded collections (e.g. projectsList with CascadeType.ALL).
        // @Transactional is required: updateLastActiveAt is a @Modifying
        // UPDATE query and fails with TransactionRequiredException otherwise
        // (mirrors the /me endpoint above).
        userRepository.updateLastActiveAt(user.getEmail(), OffsetDateTime.now());
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
                // Mentors who have not completed onboarding must NEVER appear in
                // Explore / recommendations / featured lists.
                .filter(User::isProfileCompleted)
                .map(mentor -> {
                    double averageRating = mentorReviewRepository.averageRatingByMentorId(mentor.getId()).orElse(0.0);
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
            // Only completed mentors contribute to the discoverable skill index.
            if (!mentor.isProfileCompleted()) {
                continue;
            }
            skills.addAll(extractSkillNames(mentor.getSkills()));
        }
        return new ApiResponse<>("Mentor skills fetched", new ArrayList<>(skills));
    }

    @GetMapping("/mentors/live")
    public ApiResponse<List<LiveMentorResponse>> liveMentors(
            @RequestParam(defaultValue = "24") int recentHours) {
        int safeRecentHours = Math.max(1, Math.min(168, recentHours));
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime cutoff = now.minusHours(safeRecentHours);

        List<LiveMentorResponse> mentors = userRepository
                .findByRoleAndEnabledTrueAndLastActiveAtAfterOrderByLastActiveAtDesc(UserRole.MENTOR, cutoff)
                .stream()
                // Incomplete mentors never surface in live-mentor listings.
                .filter(User::isProfileCompleted)
                .map(mentor -> {
                    double averageRating = mentorReviewRepository.averageRatingByMentorId(mentor.getId()).orElse(0.0);
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
                // Incomplete mentors are treated as non-existent: a direct URL
                // must not reveal an onboarding-in-progress profile.
                .filter(user -> user.getRole() == UserRole.MENTOR && user.isProfileCompleted())
                .orElseThrow(() -> new IllegalArgumentException("Mentor not found"));

        double averageRating = mentorReviewRepository.averageRatingByMentorId(mentorId).orElse(0.0);
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
        profileCompletionGuard.requireProfileCompleted(user,
                "Please complete your profile before connecting a wallet.");
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
        // Log only the userId + which fields changed — never the payload itself
        // (aboutMe/resumeUrl/certificates contain personal data / PII).
        log.info("updateProfile userId={} fields=[skills={},aboutMe={},githubUrl={},linkedinUrl={},profileImageUrl={},"
                        + "projects={},certificates={},pastTeachingSessions={},resumeUrl={},headline={},country={},"
                        + "state={},city={},phoneNumber={},timezone={},education={},portfolioUrl={},availability={},"
                        + "learningGoals={},currentSkillLevel={},yearsOfExperience={},hourlyRate={}]",
                user.getId(),
                req.skills() != null, req.aboutMe() != null, req.githubUrl() != null,
                req.linkedinUrl() != null, req.profileImageUrl() != null, req.projects() != null,
                req.certificates() != null, req.pastTeachingSessions() != null, req.resumeUrl() != null,
                req.headline() != null, req.country() != null, req.state() != null, req.city() != null,
                req.phoneNumber() != null, req.timezone() != null, req.education() != null,
                req.portfolioUrl() != null, req.availability() != null, req.learningGoals() != null,
                req.currentSkillLevel() != null, req.yearsOfExperience() != null, req.hourlyRate() != null);
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
        if (req.resumeUrl() != null) {
            user.setResumeUrl(normalizeHttpUrl(req.resumeUrl()));
        }
        if (req.headline() != null) {
            user.setHeadline(trimToNull(req.headline()));
        }
        if (req.yearsOfExperience() != null) {
            user.setYearsOfExperience(req.yearsOfExperience());
        }
        if (req.languages() != null) {
            user.setLanguages(trimToNull(req.languages()));
        }
        if (req.education() != null) {
            user.setEducation(trimToNull(req.education()));
        }
        if (req.portfolioUrl() != null) {
            user.setPortfolioUrl(normalizeHttpUrl(req.portfolioUrl()));
        }
        if (req.hourlyRate() != null) {
            user.setHourlyRate(req.hourlyRate());
        }
        if (req.timezone() != null) {
            user.setTimezone(trimToNull(req.timezone()));
        }
        if (req.availability() != null) {
            user.setAvailability(trimToNull(req.availability()));
        }
        if (req.country() != null) {
            user.setCountry(trimToNull(req.country()));
        }
        if (req.state() != null) {
            user.setState(trimToNull(req.state()));
        }
        if (req.city() != null) {
            user.setCity(trimToNull(req.city()));
        }
        if (req.phoneNumber() != null) {
            user.setPhoneNumber(trimToNull(req.phoneNumber()));
        }
        if (req.learningGoals() != null) {
            user.setLearningGoals(trimToNull(req.learningGoals()));
        }
        if (req.currentSkillLevel() != null) {
            user.setCurrentSkillLevel(trimToNull(req.currentSkillLevel()));
        }
        // A profile that passes the full onboarding validation can be marked
        // complete via the regular update endpoint as well.
        if (Boolean.TRUE.equals(req.profileCompleted())) {
            user.setProfileCompleted(true);
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

    /**
     * Dedicated onboarding endpoint: persists the full profile payload and,
     * only after the backend has verified every role-specific required field,
     * permanently marks the account {@code profileCompleted = true}.
     *
     * <p>
     * The frontend is never trusted — all required-field validation is
     * re-executed here, and missing fields are reported as a 400 so the client
     * can surface inline errors.
     */
    @PostMapping("/me/profile/complete")
    public ApiResponse<UserProfileResponse> completeProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ProfileCompletionRequest req) {
        // Re-fetch within a transaction so every column is safely accessible.
        User managedUser = userRepository.findById(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (managedUser.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admins do not use the profile completion flow.");
        }

        List<String> missing = missingRequiredFields(managedUser.getRole(), req);
        if (!missing.isEmpty()) {
            throw new BadRequestException(
                    "Profile is incomplete. Missing required fields: " + String.join(", ", missing));
        }

        applyProfileCompletionFields(managedUser, req);
        managedUser.setProfileCompleted(true);
        userRepository.save(managedUser);

        log.info("profile_completed userId={} role={}", managedUser.getId(), managedUser.getRole().name());
        return new ApiResponse<>("Profile completed", UserProfileResponse.from(managedUser));
    }

    private static List<String> missingRequiredFields(UserRole role, ProfileCompletionRequest req) {
        List<String> missing = new ArrayList<>();

        Map<String, String> commonFields = new LinkedHashMap<>();
        commonFields.put("fullName", req.fullName());
        commonFields.put("profileImageUrl", req.profileImageUrl());
        commonFields.put("aboutMe", req.aboutMe());
        commonFields.put("skills", req.skills());
        commonFields.put("languages", req.languages());
        commonFields.put("country", req.country());
        commonFields.put("state", req.state());
        commonFields.put("city", req.city());
        commonFields.put("timezone", req.timezone());
        commonFields.put("phoneNumber", req.phoneNumber());
        commonFields.forEach((name, value) -> {
            if (!hasValue(value)) {
                missing.add(name);
            }
        });

        if (role == UserRole.MENTOR) {
            if (!hasValue(req.headline())) {
                missing.add("headline");
            }
            if (req.yearsOfExperience() == null || req.yearsOfExperience() <= 0) {
                missing.add("yearsOfExperience");
            }
            if (!hasValue(req.education())) {
                missing.add("education");
            }
            if (!hasValue(req.linkedinUrl())) {
                missing.add("linkedinUrl");
            }
            if (!hasValue(req.portfolioUrl())) {
                missing.add("portfolioUrl");
            }
            if (req.hourlyRate() == null || req.hourlyRate().signum() <= 0) {
                missing.add("hourlyRate");
            }
            if (!hasValue(req.availability())) {
                missing.add("availability");
            }
        } else {
            // LEARNER
            if (!hasValue(req.learningGoals())) {
                missing.add("learningGoals");
            }
            if (!hasValue(req.currentSkillLevel())) {
                missing.add("currentSkillLevel");
            }
        }
        return missing;
    }

    private static void applyProfileCompletionFields(User user, ProfileCompletionRequest req) {
        user.setFullName(trimToNull(req.fullName()));
        user.setProfileImageUrl(normalizeHttpUrl(req.profileImageUrl()));
        user.setAboutMe(trimToNull(req.aboutMe()));
        user.setSkills(trimToNull(req.skills()));
        user.setLanguages(trimToNull(req.languages()));
        user.setCountry(trimToNull(req.country()));
        user.setState(trimToNull(req.state()));
        user.setCity(trimToNull(req.city()));
        user.setTimezone(trimToNull(req.timezone()));
        user.setPhoneNumber(trimToNull(req.phoneNumber()));
        user.setLearningGoals(trimToNull(req.learningGoals()));
        user.setCurrentSkillLevel(trimToNull(req.currentSkillLevel()));
        if (hasValue(req.headline())) {
            user.setHeadline(trimToNull(req.headline()));
        }
        if (req.yearsOfExperience() != null && req.yearsOfExperience() > 0) {
            user.setYearsOfExperience(req.yearsOfExperience());
        }
        if (hasValue(req.education())) {
            user.setEducation(trimToNull(req.education()));
        }
        if (hasValue(req.linkedinUrl())) {
            user.setLinkedinUrl(normalizeHttpUrl(req.linkedinUrl()));
        }
        if (hasValue(req.portfolioUrl())) {
            user.setPortfolioUrl(normalizeHttpUrl(req.portfolioUrl()));
        }
        if (req.hourlyRate() != null && req.hourlyRate().signum() > 0) {
            user.setHourlyRate(req.hourlyRate());
        }
        if (hasValue(req.availability())) {
            user.setAvailability(trimToNull(req.availability()));
        }
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
            throw new IllegalArgumentException("URLs must start with http:// or https://");
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

    /** Required onboarding fields for mentors. */
    private static final List<String> MENTOR_FIELDS = List.of(
            "fullName", "headline", "aboutMe", "skills", "yearsOfExperience", "languages",
            "education", "linkedinUrl", "portfolioUrl", "hourlyRate", "timezone", "availability",
            "country", "state", "city", "phoneNumber", "profileImageUrl");

    /** Required onboarding fields for learners. */
    private static final List<String> LEARNER_FIELDS = List.of(
            "fullName", "aboutMe", "learningGoals", "skills", "currentSkillLevel", "languages",
            "country", "state", "city", "timezone", "phoneNumber", "profileImageUrl");

    /**
     * Computes the onboarding completion percentage + missing field list for a
     * user based on the role-specific required fields. Admins are exempt.
     */
    private static ProfileCompletion computeProfileCompletion(User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return new ProfileCompletion(100, List.of());
        }
        List<String> required = user.getRole() == UserRole.MENTOR ? MENTOR_FIELDS : LEARNER_FIELDS;
        List<String> missing = required.stream()
                .filter(field -> !hasProfileValue(user, field))
                .toList();
        int total = required.size();
        int completed = total - missing.size();
        int percent = Math.round(completed / (float) total * 100);
        return new ProfileCompletion(percent, missing);
    }

    private static boolean hasProfileValue(User user, String field) {
        return switch (field) {
            case "fullName" -> hasValue(user.getFullName());
            case "headline" -> hasValue(user.getHeadline());
            case "aboutMe" -> hasValue(user.getAboutMe());
            case "skills" -> hasValue(user.getSkills());
            case "yearsOfExperience" ->
                    user.getYearsOfExperience() != null && user.getYearsOfExperience() > 0;
            case "languages" -> hasValue(user.getLanguages());
            case "education" -> hasValue(user.getEducation());
            case "linkedinUrl" -> hasValue(user.getLinkedinUrl());
            case "portfolioUrl" -> hasValue(user.getPortfolioUrl());
            case "hourlyRate" ->
                    user.getHourlyRate() != null && user.getHourlyRate().signum() > 0;
            case "timezone" -> hasValue(user.getTimezone());
            case "availability" -> hasValue(user.getAvailability());
            case "country" -> hasValue(user.getCountry());
            case "state" -> hasValue(user.getState());
            case "city" -> hasValue(user.getCity());
            case "phoneNumber" -> hasValue(user.getPhoneNumber());
            case "profileImageUrl" -> hasValue(user.getProfileImageUrl());
            case "learningGoals" -> hasValue(user.getLearningGoals());
            case "currentSkillLevel" -> hasValue(user.getCurrentSkillLevel());
            default -> true;
        };
    }

    private static boolean hasValue(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private record ProfileCompletion(int percent, List<String> missing) {
    }

/**
 * Immutable data carrier for wallet update request.
 */
    public record WalletUpdateRequest(String walletAddress) {
    }

/**
 * Immutable data carrier for role update request.
 */
    public record RoleUpdateRequest(UserRole role) {
    }

/**
 * Immutable data carrier for user profile update request.
 */
    public record UserProfileUpdateRequest(
            @Size(max = 500) String skills,
            @Size(max = 2000) String aboutMe,
            @Size(max = 500) String githubUrl,
            @Size(max = 500) String linkedinUrl,
            @Size(max = 1000) String profileImageUrl,
            @Size(max = 6000) String projects,
            @Size(max = 6000) String certificates,
            @Size(max = 6000) String pastTeachingSessions,
            @Size(max = 1000) String resumeUrl,
            @Size(max = 200) String headline,
            @Size(max = 500) String languages,
            @Size(max = 500) String country,
            @Size(max = 500) String state,
            @Size(max = 500) String city,
            @Size(max = 40) String phoneNumber,
            @Size(max = 100) String timezone,
            @Size(max = 6000) String education,
            @Size(max = 1000) String portfolioUrl,
            @Size(max = 6000) String availability,
            @Size(max = 6000) String learningGoals,
            @Size(max = 50) String currentSkillLevel,
            Integer yearsOfExperience,
            java.math.BigDecimal hourlyRate,
            Boolean profileCompleted) {
    }

    /**
     * Payload for the mandatory onboarding endpoint
     * {@code POST /api/v1/users/me/profile/complete}. Every field is optional
     * on the wire; the backend enforces role-specific required fields.
     */
    public record ProfileCompletionRequest(
            String fullName,
            String profileImageUrl,
            String headline,
            String aboutMe,
            String skills,
            Integer yearsOfExperience,
            String languages,
            String education,
            String linkedinUrl,
            String portfolioUrl,
            java.math.BigDecimal hourlyRate,
            String timezone,
            String availability,
            String country,
            String state,
            String city,
            String phoneNumber,
            String learningGoals,
            String currentSkillLevel) {
    }

    /**
     * Real-time username availability check (public). The spec endpoint is
     * {@code GET /api/v1/users/check-username}; the legacy
     * {@code /me/check-username} path is kept as an alias for existing clients.
     * Availability is case-insensitive and only checks "not reserved + not
     * taken" — format rules are enforced on submit by the backend.
     */
    @GetMapping({ "/me/check-username", "/check-username" })
    public ApiResponse<UsernameAvailabilityResponse> checkUsername(@RequestParam String username) {
        String lower = UsernameRules.normalizeLower(username);
        boolean available = lower != null
                && !UsernameRules.isReserved(lower)
                && !userRepository.existsByUsernameLower(lower);
        String suggestion = available ? null : generateSuggestion(lower);
        return new ApiResponse<>("Username check", new UsernameAvailabilityResponse(available, suggestion));
    }

    private String generateSuggestion(String base) {
        String safeBase = base == null ? "user" : base;
        for (int i = 1; i < 100; i++) {
            String suggestion = safeBase + i;
            if (!UsernameRules.isReserved(suggestion)
                    && !userRepository.existsByUsernameLower(suggestion.toLowerCase())) {
                return suggestion;
            }
        }
        return safeBase + System.currentTimeMillis() % 10000;
    }

/**
 * Immutable data carrier for username availability response.
 */
    public record UsernameAvailabilityResponse(boolean available, String suggestion) { }

    @PutMapping("/me/username")
    public ApiResponse<UserProfileResponse> updateUsername(
            @AuthenticationPrincipal User user,
            @RequestBody @Valid UsernameUpdateRequest req) {
        String displayUsername = req.username().trim();
        String normalized = displayUsername.toLowerCase(java.util.Locale.ROOT);
        UsernameRules.validateFormat(displayUsername);
        if (UsernameRules.isReserved(displayUsername)) {
            throw new IllegalArgumentException("This username is reserved.");
        }
        // Case-insensitive uniqueness check, excluding the caller's own row
        // (changing "Nakul" to "nakul" — or keeping the same handle — is fine).
        userRepository.findByUsernameLower(normalized)
                .filter(owner -> !owner.getId().equals(user.getId()))
                .ifPresent(owner -> {
                    throw new ApiClientException(HttpStatus.CONFLICT, "USERNAME_TAKEN",
                            "This username is already taken. Please choose another username.", false);
                });
        user.setUsername(displayUsername);
        user.setUsernameLower(normalized);
        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiClientException(HttpStatus.CONFLICT, "USERNAME_TAKEN",
                    "This username is already taken. Please choose another username.", false);
        }
        return new ApiResponse<>("Username updated", UserProfileResponse.from(user));
    }

/**
 * Immutable data carrier for username update request.
 */
    public record UsernameUpdateRequest(
            @jakarta.validation.constraints.NotBlank
            @Size(min = 4, max = 30) String username) { }

/**
 * Immutable data carrier for user profile response.
 */
    public record UserProfileResponse(
            Long id,
            String email,
            String username,
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
            String resumeUrl,
            Boolean mentorVerified,
            String verifiedSkills,
            Integer profileCompletionPercent,
            List<String> profileCompletionMissing,
            Boolean profileCompleted,
            String headline,
            Integer yearsOfExperience,
            String languages,
            String education,
            String portfolioUrl,
            java.math.BigDecimal hourlyRate,
            String timezone,
            String availability,
            String country,
            String state,
            String city,
            String phoneNumber,
            String learningGoals,
            String currentSkillLevel) {
        static UserProfileResponse from(User user) {
            ProfileCompletion completion = computeProfileCompletion(user);
            return new UserProfileResponse(
                    user.getId(),
                    user.getEmail(),
                    user.getDisplayUsername(),
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
                    user.getResumeUrl(),
                    user.isMentorVerified(),
                    user.getVerifiedSkills(),
                    completion.percent(),
                    completion.missing(),
                    user.isProfileCompleted(),
                    user.getHeadline(),
                    user.getYearsOfExperience(),
                    user.getLanguages(),
                    user.getEducation(),
                    user.getPortfolioUrl(),
                    user.getHourlyRate(),
                    user.getTimezone(),
                    user.getAvailability(),
                    user.getCountry(),
                    user.getState(),
                    user.getCity(),
                    user.getPhoneNumber(),
                    user.getLearningGoals(),
                    user.getCurrentSkillLevel());
        }
    }

/**
 * Immutable data carrier for public mentor profile response.
 */
    public record PublicMentorProfileResponse(
            Long id,
            String createdAt,
            String fullName,
            String username,
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
                    mentor.getCreatedAt() == null ? null : mentor.getCreatedAt().toString(),
                    mentor.getFullName(),
                    mentor.getDisplayUsername(),
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

/**
 * Immutable data carrier for live mentor response.
 */
    public record LiveMentorResponse(
            Long id,
            String fullName,
            String username,
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
                    mentor.getDisplayUsername(),
                    mentor.getSkills(),
                    mentor.getProfileImageUrl(),
                    averageRating,
                    totalReviews,
                    mentor.getLastActiveAt() == null ? null : mentor.getLastActiveAt().toString(),
                    liveNow);
        }
    }

/**
 * Immutable data carrier for referral summary response.
 */
    public record ReferralSummaryResponse(
            String referralCode,
            int totalReferrals,
            int totalCreditsEarned) {
    }
}
