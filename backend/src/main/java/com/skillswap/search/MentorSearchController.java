package com.skillswap.search;

import com.skillswap.availability.UserAvailabilitySlotRepository;
import com.skillswap.booking.BookingRepository;
import com.skillswap.booking.BookingStatus;
import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class MentorSearchController {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final UserAvailabilitySlotRepository availabilitySlotRepository;

    @GetMapping("/mentors")
    public ApiResponse<List<MentorSearchResult>> searchMentors(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "20") int limit) {

        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        int safeLimit = Math.max(1, Math.min(limit, 100));

        List<MentorSearchResult> results = userRepository.findByRole(UserRole.MENTOR).stream()
                .map(mentor -> scoreMentor(mentor, query))
                .sorted(Comparator.comparingDouble(MentorSearchResult::score).reversed())
                .limit(safeLimit)
                .toList();

        return new ApiResponse<>("Mentor search results fetched", results);
    }

    private MentorSearchResult scoreMentor(User mentor, String query) {
        String haystack = String.join(" ",
                safe(mentor.getFullName()),
                safe(mentor.getAboutMe()),
                safe(mentor.getSkills()))
                .toLowerCase(Locale.ROOT);

        double skillMatchScore = computeSkillMatch(query, haystack);

        long totalBookings = bookingRepository.countBySessionMentorId(mentor.getId());
        long completedBookings = bookingRepository.countBySessionMentorIdAndBookingStatus(mentor.getId(),
                BookingStatus.COMPLETED);
        double completionRate = totalBookings == 0 ? 0.5 : ((double) completedBookings / (double) totalBookings);
        double completionScore = completionRate * 20.0;

        int verifiedSkillCount = safe(mentor.getVerifiedSkills()).isBlank()
                ? 0
                : (int) Arrays.stream(mentor.getVerifiedSkills().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .count();
        double ratingScore = Math.min(20.0, verifiedSkillCount * 4.0);

        long availabilitySlots = availabilitySlotRepository.countByUserIdAndActiveTrue(mentor.getId());
        double responseScore = Math.min(10.0, availabilitySlots > 0 ? 10.0 : 4.0);

        double totalScore = Math.round((skillMatchScore + ratingScore + responseScore + completionScore) * 10.0) / 10.0;

        return new MentorSearchResult(
                mentor.getId(),
                mentor.getFullName(),
                mentor.getSkills(),
                totalScore,
                Math.round(skillMatchScore * 10.0) / 10.0,
                Math.round(ratingScore * 10.0) / 10.0,
                Math.round(responseScore * 10.0) / 10.0,
                Math.round(completionScore * 10.0) / 10.0,
                totalBookings,
                completedBookings);
    }

    private static double computeSkillMatch(String query, String haystack) {
        if (query.isBlank()) {
            return 25.0;
        }

        String[] terms = query.split("\\s+");
        if (terms.length == 0) {
            return 25.0;
        }

        int matchedTerms = 0;
        for (String term : terms) {
            if (!term.isBlank() && haystack.contains(term)) {
                matchedTerms++;
            }
        }

        double ratio = (double) matchedTerms / (double) terms.length;
        return ratio * 50.0;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    public record MentorSearchResult(
            Long mentorId,
            String mentorName,
            String skills,
            Double score,
            Double skillMatch,
            Double ratingScore,
            Double responseTimeScore,
            Double completionRateScore,
            Long totalSessions,
            Long completedSessions) {
    }
}
