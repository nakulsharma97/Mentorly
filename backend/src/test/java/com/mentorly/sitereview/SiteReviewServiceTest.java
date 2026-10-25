package com.mentorly.sitereview;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mentorly.common.ApiClientException;
import com.mentorly.common.AuditLogService;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.sitereview.SiteReviewDtos.CreateSiteReviewRequest;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewResponse;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SiteReviewServiceTest {

    @Mock
    private SiteReviewRepository siteReviewRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private ProfileCompletionGuard profileCompletionGuard;

    @InjectMocks
    private SiteReviewService service;

    private User learner;
    private User admin;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(10L);
        learner.setFullName("Test Learner");
        learner.setRole(UserRole.LEARNER);
        learner.setProfileCompleted(true);

        admin = new User();
        admin.setId(1L);
        admin.setFullName("Test Admin");
        admin.setRole(UserRole.ADMIN);
    }

    private CreateSiteReviewRequest validRequest() {
        return new CreateSiteReviewRequest(5, "Great platform",
                "Mentorly made learning smooth and genuinely fun to use.");
    }

    private SiteReview existingReview(SiteReviewStatus status) {
        SiteReview review = new SiteReview();
        review.setId(77L);
        review.setUser(learner);
        review.setRating(4);
        review.setTitle("Old title");
        review.setComment("An older comment about the platform itself.");
        review.setStatus(status);
        review.setAdminNote(status == SiteReviewStatus.REJECTED ? "Spam" : null);
        return review;
    }

    // ── create ─────────────────────────────────────────────────

    @Test
    void create_persistsPendingReviewWithSanitizedText() {
        when(siteReviewRepository.existsByUserId(10L)).thenReturn(false);
        when(siteReviewRepository.save(any(SiteReview.class))).thenAnswer(inv -> {
            SiteReview saved = inv.getArgument(0);
            saved.setId(501L);
            return saved;
        });

        SiteReviewResponse response = service.create(learner,
                new CreateSiteReviewRequest(5, "  <b>Wow</b>  ",
                        "  This is an <script>alert(1)</script> amazing platform to learn on!  "));

        assertEquals(SiteReviewStatus.PENDING, response.status());
        assertEquals(5, response.rating());
        assertFalse(response.comment().contains("<script>"), "script tags must be stripped");
        assertFalse(response.title().contains("<b>"), "html tags must be stripped");
        assertTrue(response.comment().length() >= 10);
        assertNull(response.adminNote());
        verify(profileCompletionGuard).requireProfileCompleted(eq(learner), anyString());
    }

    @Test
    void create_duplicateReview_throwsConflict() {
        when(siteReviewRepository.existsByUserId(10L)).thenReturn(true);

        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> service.create(learner, validRequest()));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    void create_invalidRating_rejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(learner, new CreateSiteReviewRequest(6, null, "A perfectly long comment here.")));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(learner, new CreateSiteReviewRequest(null, null, "A perfectly long comment here.")));
    }

    @Test
    void create_tooShortComment_rejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(learner, new CreateSiteReviewRequest(3, null, "too short")));
    }

    @Test
    void create_tooLongTitle_rejected() {
        String longTitle = "T".repeat(121);
        assertThrows(IllegalArgumentException.class,
                () -> service.create(learner, new CreateSiteReviewRequest(3, longTitle, "A perfectly long comment here.")));
    }

    @Test
    void create_adminAccount_rejected() {
        assertThrows(IllegalArgumentException.class, () -> service.create(admin, validRequest()));
    }

    // ── edit / delete ──────────────────────────────────────────

    @Test
    void update_resetsStatusToPendingAndClearsAdminNote() {
        SiteReview existing = existingReview(SiteReviewStatus.APPROVED);
        when(siteReviewRepository.findByUserId(10L)).thenReturn(Optional.of(existing));
        when(siteReviewRepository.save(any(SiteReview.class))).thenAnswer(inv -> inv.getArgument(0));

        SiteReviewResponse response = service.update(learner,
                new CreateSiteReviewRequest(3, "Updated title", "A completely new comment about Mentorly!"));

        assertEquals(SiteReviewStatus.PENDING, response.status());
        assertNull(response.adminNote(), "admin note must be cleared when the review changes");
        assertEquals(3, response.rating());
    }

    @Test
    void update_withoutExistingReview_rejected() {
        when(siteReviewRepository.findByUserId(10L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.update(learner, validRequest()));
    }

    @Test
    void delete_removesOwnReview() {
        SiteReview existing = existingReview(SiteReviewStatus.PENDING);
        when(siteReviewRepository.findByUserId(10L)).thenReturn(Optional.of(existing));

        service.delete(learner);

        verify(siteReviewRepository).delete(existing);
    }

    @Test
    void delete_withoutExistingReview_rejected() {
        when(siteReviewRepository.findByUserId(10L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.delete(learner));
    }

    // ── admin moderation ───────────────────────────────────────

    @Test
    void approve_setsStatusWritesAuditAndKeepsNote() {
        SiteReview existing = existingReview(SiteReviewStatus.PENDING);
        when(siteReviewRepository.findById(77L)).thenReturn(Optional.of(existing));
        when(siteReviewRepository.save(any(SiteReview.class))).thenAnswer(inv -> inv.getArgument(0));

        SiteReviewResponse response = service.adminApprove(admin, 77L, "<b>Great</b> write-up");

        assertEquals(SiteReviewStatus.APPROVED, response.status());
        assertEquals("Great write-up", response.adminNote());
        verify(auditLogService).logAdmin(eq(admin), eq("APPROVE_SITE_REVIEW"), eq("SiteReview"), eq(77L), anyString());
    }

    @Test
    void reject_setsStatusAndWritesAudit() {
        SiteReview existing = existingReview(SiteReviewStatus.PENDING);
        when(siteReviewRepository.findById(77L)).thenReturn(Optional.of(existing));
        when(siteReviewRepository.save(any(SiteReview.class))).thenAnswer(inv -> inv.getArgument(0));

        SiteReviewResponse response = service.adminReject(admin, 77L, "Off-topic");

        assertEquals(SiteReviewStatus.REJECTED, response.status());
        assertEquals("Off-topic", response.adminNote());
        verify(auditLogService).logAdmin(eq(admin), eq("REJECT_SITE_REVIEW"), eq("SiteReview"), eq(77L), anyString());
    }

    @Test
    void approve_unknownReview_throwsNotFound() {
        when(siteReviewRepository.findById(404L)).thenReturn(Optional.empty());

        ApiClientException ex = assertThrows(ApiClientException.class,
                () -> service.adminApprove(admin, 404L, null));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    void adminList_passesStatusFilterThroughToRepository() {
        when(siteReviewRepository.findByStatus(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(Page.empty());

        service.adminList(SiteReviewStatus.APPROVED, 0, 20);

        verify(siteReviewRepository).findByStatus(eq(SiteReviewStatus.APPROVED), any(Pageable.class));
    }

    @Test
    void adminList_clampsOversizedPageSize() {
        when(siteReviewRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        service.adminList(null, -3, 5000);

        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(siteReviewRepository).findAll(captor.capture());
        assertEquals(0, captor.getValue().getPageNumber());
        assertEquals(100, captor.getValue().getPageSize());
    }

    // ── public list ────────────────────────────────────────────

    @Test
    void publicList_queriesOnlyApprovedSiteReviews() {
        when(siteReviewRepository.findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of());

        List<SiteReview> result = service.latestApprovedWithUser(6);

        assertTrue(result.isEmpty());
        verify(siteReviewRepository).findByStatusWithUser(eq(SiteReviewStatus.APPROVED), any(Pageable.class));
    }
}
