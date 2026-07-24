package com.skillswap.notification;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private AppNotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationPreferenceRepository preferenceRepository;

    @Mock
    private EmailNotificationService emailNotificationService;

    @InjectMocks
    private NotificationService notificationService;

    @Captor
    private ArgumentCaptor<AppNotification> notificationCaptor;

    private User learner;
    private User mentor;
    private NotificationPreference preference;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setEmail("learner@test.com");
        learner.setRole(UserRole.LEARNER);

        mentor = new User();
        mentor.setId(2L);
        mentor.setEmail("mentor@test.com");
        mentor.setRole(UserRole.MENTOR);

        preference = new NotificationPreference();
        preference.setUser(learner);
        preference.setEmailEnabled(true);
        preference.setBookingUpdates(true);
        preference.setSessionAnnouncements(true);
        preference.setReviewAlerts(true);
        preference.setCertificationAlerts(true);
        preference.setRoleChangeAlerts(true);
    }

    // ── notifyUser ──────────────────────────────────────

    @Test
    void notifyUserCreatesNotificationAndSendsEmail() {
        when(userRepository.findById(learner.getId())).thenReturn(Optional.of(learner));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.of(preference));

        notificationService.notifyUser(learner.getId(), "BOOKING_CREATED",
                "New Booking", "You have a new booking request", 100L);

        verify(notificationRepository).save(notificationCaptor.capture());
        AppNotification saved = notificationCaptor.getValue();
        assertEquals("New Booking", saved.getTitle());
        assertEquals("BOOKING_CREATED", saved.getType());
        assertEquals(100L, saved.getReferenceId());
        assertEquals(learner.getId(), saved.getUser().getId());

        verify(emailNotificationService).sendNotificationEmail(eq(learner), anyString(), anyString());
    }

    @Test
    void notifyUserThrowsWhenUserNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> notificationService.notifyUser(999L, "TEST", "Title", "Message", null));
        assertEquals("User not found", ex.getMessage());
    }

    @Test
    void notifyUserDoesNotSendEmailWhenEmailDisabled() {
        preference.setEmailEnabled(false);
        when(userRepository.findById(learner.getId())).thenReturn(Optional.of(learner));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.of(preference));

        notificationService.notifyUser(learner.getId(), "BOOKING_CREATED",
                "New Booking", "Message", null);

        verify(emailNotificationService, never()).sendNotificationEmail(any(), anyString(), anyString());
    }

    @Test
    void notifyUserDoesNotSendEmailWhenBookingUpdatesDisabled() {
        preference.setBookingUpdates(false);
        when(userRepository.findById(learner.getId())).thenReturn(Optional.of(learner));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.of(preference));

        notificationService.notifyUser(learner.getId(), "BOOKING_CREATED",
                "New Booking", "Message", null);

        verify(emailNotificationService, never()).sendNotificationEmail(any(), anyString(), anyString());
    }

    @Test
    void notifyUserSendsEmailForCertificationWhenEnabled() {
        when(userRepository.findById(learner.getId())).thenReturn(Optional.of(learner));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.of(preference));

        notificationService.notifyUser(learner.getId(), "CERTIFICATION_EARNED",
                "Certification", "You earned a certification!", null);

        verify(emailNotificationService).sendNotificationEmail(eq(learner), anyString(), anyString());
    }

    // ── notifyUsers ─────────────────────────────────────

    @Test
    void notifyUsersSendsToEachUser() {
        when(userRepository.findById(anyLong())).thenReturn(Optional.of(learner), Optional.of(mentor));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByUserId(anyLong())).thenReturn(Optional.of(preference));

        notificationService.notifyUsers(List.of(1L, 2L), "ANNOUNCEMENT",
                "Announcement", "Platform announcement", null);

        verify(notificationRepository, times(2)).save(any());
        verify(emailNotificationService, times(2)).sendNotificationEmail(any(), anyString(), anyString());
    }

    @Test
    void notifyUsersDeduplicatesIds() {
        when(userRepository.findById(anyLong())).thenReturn(Optional.of(learner));
        when(notificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(preferenceRepository.findByUserId(anyLong())).thenReturn(Optional.of(preference));

        notificationService.notifyUsers(List.of(1L, 1L, 1L), "TEST", "Title", "Message", null);

        // distinct() should reduce to 1
        verify(notificationRepository, times(1)).save(any());
    }

    // ── getOrCreatePreference ───────────────────────────

    @Test
    void getOrCreatePreferenceReturnsExisting() {
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.of(preference));

        NotificationPreference result = notificationService.getOrCreatePreference(learner);

        assertSame(preference, result);
        verify(preferenceRepository, never()).save(any());
    }

    @Test
    void getOrCreatePreferenceCreatesNew() {
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.empty());
        when(preferenceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NotificationPreference result = notificationService.getOrCreatePreference(learner);

        assertNotNull(result);
        assertEquals(learner.getId(), result.getUser().getId());
        verify(preferenceRepository).save(any());
    }

    // ── updatePreference ────────────────────────────────

    @Test
    void updatePreferenceUpdatesAllFields() {
        when(preferenceRepository.findByUserId(learner.getId())).thenReturn(Optional.of(preference));
        when(preferenceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NotificationPreference result = notificationService.updatePreference(
                learner, false, true, false, true, false, true);

        assertFalse(result.isEmailEnabled());
        assertTrue(result.isBookingUpdates());
        assertFalse(result.isSessionAnnouncements());
        assertTrue(result.isReviewAlerts());
        assertFalse(result.isCertificationAlerts());
        assertTrue(result.isRoleChangeAlerts());
    }
}
