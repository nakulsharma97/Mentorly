package com.skillswap.search;

import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.ApiResponse;
import com.skillswap.review.MentorReviewRepository;
import com.skillswap.session.SessionRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class MentorSearchController {

        private final UserRepository userRepository;
        private final BookingRepository bookingRepository;
        private final MentorReviewRepository mentorReviewRepository;
        private final SessionRepository sessionRepository;

        @GetMapping("/mentors")
        public ApiResponse<List<MentorSearchResult>> searchMentors(
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
                int offset = safePage * safeSize;

                boolean hasSearchCriteria = !normalizedQuery.isBlank()
                                || safeMinPrice != null
                                || safeMaxPrice != null
                                || safeMinRating > 0.0;

                List<User> mentors = hasSearchCriteria
                                ? userRepository.searchMentorsFiltered(
                                                normalizedQuery,
                                                safeMinPrice,
                                                safeMaxPrice,
                                                safeMinRating,
                                                safeSize,
                                                offset)
                                : userRepository.findByRole(UserRole.MENTOR).stream()
                                                .filter(User::isEnabled)
                                                .sorted(Comparator.comparing(User::getLastActiveAt,
                                                                Comparator.nullsLast(Comparator.reverseOrder())))
                                                .skip(offset)
                                                .limit(safeSize)
                                                .toList();

                List<MentorSearchResult> results = mentors.stream()
                                .map(this::scoreMentor)
                                .toList();

                return new ApiResponse<>("Mentor search results fetched", results);
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
