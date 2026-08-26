package com.mentorly.certification;

import com.mentorly.booking.Booking;
import com.mentorly.booking.BookingRepository;
import com.mentorly.booking.BookingStatus;
import com.mentorly.notification.NotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service implementing certification business logic.
 */
@Service
@RequiredArgsConstructor
public class CertificationService {

    private final UserCertificationRepository certificationRepository;
    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;

    public List<UserCertification> listForUser(Long userId) {
        return certificationRepository.findByUserIdOrderByIssuedAtDesc(userId);
    }

    public Page<UserCertification> listForUser(Long userId, Pageable pageable) {
        return certificationRepository.findByUserIdOrderByIssuedAtDesc(userId, pageable);
    }

    public List<UserCertification> evaluateAndAward(User user) {
        List<UserCertification> newlyAwarded = new ArrayList<>();

        long completedAsLearner = bookingRepository.countByLearnerIdAndBookingStatus(user.getId(),
                BookingStatus.COMPLETED);
        long completedAsMentor = bookingRepository.countBySessionMentorIdAndBookingStatus(user.getId(),
                BookingStatus.COMPLETED);

        if (completedAsLearner >= 1) {
            awardIfMissing(newlyAwarded, user, "LEARNER_FIRST_STEP", "First Learning Milestone",
                    "Completed your first learning session.", null);
        }
        if (completedAsLearner >= 5) {
            awardIfMissing(newlyAwarded, user, "LEARNER_FOCUSED_FIVE", "Focused Learner",
                    "Completed 5 learning sessions.", null);
        }

        if (completedAsMentor >= 1) {
            awardIfMissing(newlyAwarded, user, "MENTOR_FIRST_CLASS", "First Class Delivered",
                    "Completed your first mentoring session.", null);
        }
        if (completedAsMentor >= 10) {
            awardIfMissing(newlyAwarded, user, "MENTOR_TEN_DELIVERED", "Trusted Mentor",
                    "Completed 10 mentoring sessions.", null);
        }

        if (user.getRole() == UserRole.MENTOR) {
            List<Booking> completedBookings = bookingRepository.findBySessionMentorIdAndBookingStatus(user.getId(),
                    BookingStatus.COMPLETED);
            Map<Long, Long> learnerFrequency = completedBookings.stream()
                    .filter(b -> b.getLearner() != null)
                    .collect(Collectors.groupingBy(b -> b.getLearner().getId(), Collectors.counting()));
            boolean hasRepeatLearner = learnerFrequency.values().stream().anyMatch(v -> v >= 2);
            if (hasRepeatLearner) {
                awardIfMissing(newlyAwarded, user, "MENTOR_REPEAT_IMPACT", "Repeat Impact",
                        "Received repeat bookings from at least one learner.", null);
            }
        }

        return newlyAwarded;
    }

    private void awardIfMissing(List<UserCertification> newlyAwarded, User user, String code, String title,
            String description, Booking sourceBooking) {
        if (certificationRepository.existsByUserIdAndCode(user.getId(), code)) {
            return;
        }
        UserCertification certification = new UserCertification();
        certification.setUser(user);
        certification.setCode(code);
        certification.setTitle(title);
        certification.setDescription(description);
        certification.setSourceBooking(sourceBooking);
        UserCertification saved = certificationRepository.save(certification);
        newlyAwarded.add(saved);

        notificationService.notifyUser(
                user.getId(),
                "CERTIFICATION_EARNED",
                "New certification earned",
                "You unlocked: " + title,
                saved.getId());
    }
}
