package com.skillswap.search;

import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.ApiResponse;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.safety.UserBlockRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.MentorVerificationStatus;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * REST controller exposing mentor search endpoints.
 */
@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class MentorSearchController {

        private final UserRepository userRepository;
        private final BookingRepository bookingRepository;
        private final DirectConversationRepository directConversationRepository;
        private final UserBlockRepository userBlockRepository;
        private final MentorReviewRepository mentorReviewRepository;
        private final SessionRepository sessionRepository;

        /**
         * Search across all enabled users (mentors + learners) by name.
         * Learners see only mentors; mentors see everyone.
         */
        @GetMapping("/users")
        public ApiResponse<List<UserSearchResult>> searchUsers(
                        @AuthenticationPrincipal User currentUser,
                        @RequestParam(required = false) String q,
                        @RequestParam(defaultValue = "10") int size) {

                String normalizedQuery = q == null ? "" : q.trim();
                int safeSize = Math.max(1, Math.min(size, 20));

                List<User> users = normalizedQuery.isBlank()
                                ? userRepository.findSuggestedForMessaging(safeSize)
                                : userRepository.searchUsersForMessaging(escapeLike(normalizedQuery), safeSize);

                OffsetDateTime onlineCutoff = OffsetDateTime.now().minusMinutes(5);

                List<UserSearchResult> results = users.stream()
                                // Admins are never messaging targets — requests
                                // must always go to a learner or mentor.
                                .filter(u -> u.getRole() != UserRole.ADMIN)
                                // Mentors are undiscoverable until an admin has
                                // APPROVED their verification application.
                                .filter(u -> u.getRole() != UserRole.MENTOR || u.isApprovedMentor())
                                .filter(u -> currentUser == null || !u.getId().equals(currentUser.getId()))
                                .map(u -> new UserSearchResult(
                                                u.getId(),
                                                u.getFullName(),
                                                u.getDisplayUsername(),
                                                u.getEmail(),
                                                u.getProfileImageUrl(),
                                                u.getRole().name(),
                                                u.getSkills(),
                                                u.getHeadline(),
                                                u.getCompany(),
                                                u.getYearsOfExperience(),
                                                u.isMentorVerified(),
                                                u.getLastActiveAt() != null
                                                                && u.getLastActiveAt().isAfter(onlineCutoff),
                                                computeAvailabilityText(u, onlineCutoff),
                                                u.getRole() == UserRole.MENTOR ? getAverageRating(u.getId()) : null,
                                                currentUser != null && canStartDirect(currentUser, u)))
                                .collect(Collectors.toList());

                return new ApiResponse<>("Users fetched", results);
        }

        private String computeAvailabilityText(User user, OffsetDateTime onlineCutoff) {
                if (user.getLastActiveAt() != null && user.getLastActiveAt().isAfter(onlineCutoff)) {
                        return "Online now";
                }
                Integer response = user.getResponseTimeMinutes();
                if (response != null && response > 0) {
                        return "Usually replies in " + response + " min";
                }
                if (user.getLastActiveAt() != null) {
                        return "Active recently";
                }
                return "Availability unknown";
        }

        private boolean canStartDirect(User currentUser, User target) {
                if (currentUser == null || target == null) {
                        return false;
                }
                if (currentUser.getId().equals(target.getId())) {
                        return false;
                }
                boolean blocked = userBlockRepository.existsByBlockerIdAndBlockedId(currentUser.getId(), target.getId())
                                || userBlockRepository.existsByBlockerIdAndBlockedId(target.getId(),
                                                currentUser.getId());
                if (blocked) {
                        return false;
                }

                if (directConversationRepository.findBetweenUsers(currentUser, target).isPresent()) {
                        return true;
                }

                return hasAcceptedSession(currentUser.getId(), target.getId());
        }

        private boolean hasAcceptedSession(Long currentUserId, Long targetUserId) {
                for (BookingStatus status : List.of(
                                BookingStatus.ACCEPTED,
                                BookingStatus.CONFIRMED,
                                BookingStatus.IN_PROGRESS,
                                BookingStatus.COMPLETED)) {
                        boolean hasForward = !bookingRepository
                                        .findByLearnerIdAndSessionMentorIdAndBookingStatusOrderByCreatedAtDesc(
                                                        currentUserId,
                                                        targetUserId,
                                                        status)
                                        .isEmpty();
                        if (hasForward) {
                                return true;
                        }

                        boolean hasReverse = !bookingRepository
                                        .findBySessionMentorIdAndLearnerIdAndBookingStatusOrderByCreatedAtDesc(
                                                        currentUserId,
                                                        targetUserId,
                                                        status)
                                        .isEmpty();
                        if (hasReverse) {
                                return true;
                        }
                }
                return false;
        }

        /**
         * Simple search result dto for users.
         */
        public record UserSearchResult(
                        Long userId,
                        String fullName,
                        String username,
                        String email,
                        String profileImageUrl,
                        String role,
                        String skills,
                        String headline,
                        String company,
                        Integer yearsOfExperience,
                        boolean mentorVerified,
                        boolean online,
                        String availability,
                        Double rating,
                        boolean canStartDirect) {
        }

        @GetMapping("/mentors")
        public ApiResponse<Page<MentorSearchResult>> searchMentors(
                        @RequestParam(required = false) String q,
                        @RequestParam(required = false) BigDecimal minPrice,
                        @RequestParam(required = false) BigDecimal maxPrice,
                        @RequestParam(required = false) Double minRating,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {

                String normalizedQuery = q == null ? "" : q.trim();
                BigDecimal safeMinPrice = minPrice;
                BigDecimal safeMaxPrice = maxPrice;
                double safeMinRating = minRating == null ? 0.0 : minRating;
                int safePage = Math.max(0, page);
                int safeSize = Math.max(1, Math.min(size, 50));
                Pageable pageable = PageRequest.of(safePage, safeSize);

                boolean hasSearchCriteria = !normalizedQuery.isBlank()
                                || safeMinPrice != null
                                || safeMaxPrice != null
                                || safeMinRating > 0.0;

                Page<User> mentorPage = hasSearchCriteria
                                ? new PageImpl<>(
                                                userRepository.searchMentorsAdvanced(
                                                                normalizedQuery,
                                                                escapeLike(normalizedQuery),
                                                                safeMinPrice,
                                                                safeMaxPrice,
                                                                safeMinRating,
                                                                null, // minExperience - not filtered by default
                                                                null, // onlineCutoff - not filtered by default
                                                                null, // savedLearnerId - not filtered by default
                                                                "recent", // default sort
                                                                safeSize,
                                                                safePage * safeSize),
                                                pageable,
                                                userRepository.countMentorsAdvanced(
                                                                normalizedQuery,
                                                                escapeLike(normalizedQuery),
                                                                safeMinPrice,
                                                                safeMaxPrice,
                                                                safeMinRating,
                                                                null,
                                                                null,
                                                                null))
                                // No-criteria branch: fully SQL-filtered, paginated
                                // mentor-directory query — no in-memory scan of the
                                // whole mentor table (the previous worst case).
                                : userRepository
                                                .findByRoleAndEnabledTrueAndProfileCompletedTrueAndVerificationStatusOrderByLastActiveAtDesc(
                                                                UserRole.MENTOR,
                                                                MentorVerificationStatus.APPROVED,
                                                                pageable);

                // Defense-in-depth: both branches filter APPROVED mentors in SQL;
                // this extra pass guards against any future filter drift.
                List<User> mentors = mentorPage.getContent().stream()
                                .filter(User::isApprovedMentor)
                                .toList();

                List<MentorSearchResult> results = mentors.stream()
                                .map(this::scoreMentor)
                                .toList();

                return new ApiResponse<>("Mentor search results fetched",
                                new PageImpl<>(results, pageable, mentorPage.getTotalElements()));
        }

        /**
         * Escapes LIKE wildcard characters so they match literally. Used only
         * for the {@code likeKeyword} parameter bound to {@code LIKE ... ESCAPE}
         * clauses; the raw {@code keyword} is passed untouched to the full-text
         * {@code MATCH ... AGAINST} clause so boolean-mode semantics are intact.
         */
        private static String escapeLike(String value) {
                if (value == null || value.isEmpty()) {
                        return value;
                }
                return value.replace("\\", "\\\\")
                                .replace("%", "\\%")
                                .replace("_", "\\_");
        }

        private MentorSearchResult scoreMentor(User mentor) {
                Double averageRating = getAverageRating(mentor.getId());
                Long totalReviews = mentorReviewRepository.countByMentorId(mentor.getId());
                BigDecimal minSessionPrice = sessionRepository.findMinPriceByMentorId(mentor.getId());
                Long totalCompletedSessions = bookingRepository.countBySessionMentorIdAndBookingStatus(
                                mentor.getId(),
                                BookingStatus.COMPLETED);

                return new MentorSearchResult(
                                mentor.getId(),
                                mentor.getFullName(),
                                mentor.getSkills(),
                                mentor.getProfileImageUrl(),
                                mentor.isMentorVerified(),
                                averageRating,
                                totalReviews,
                                minSessionPrice,
                                totalCompletedSessions);
        }

        private double getAverageRating(Long mentorId) {
                return mentorReviewRepository.averageRatingByMentorId(mentorId).orElse(0.0);
        }

        /**
         * Immutable data carrier for mentor search result.
         */
        public record MentorSearchResult(
                        Long mentorId,
                        String mentorName,
                        String skills,
                        String profileImageUrl,
                        boolean mentorVerified,
                        Double averageRating,
                        Long totalReviews,
                        BigDecimal minSessionPrice,
                        Long totalCompletedSessions) {
        }
}
