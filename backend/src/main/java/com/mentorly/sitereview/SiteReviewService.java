package com.mentorly.sitereview;

import com.mentorly.chat.ChatInputSanitizer;
import com.mentorly.common.ApiClientException;
import com.mentorly.common.AuditLogService;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.sitereview.SiteReviewDtos.CreateSiteReviewRequest;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewAdminResponse;
import com.mentorly.sitereview.SiteReviewDtos.SiteReviewResponse;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business logic for platform-wide site reviews: one review per user,
 * plain-text sanitized content, moderation before public display.
 *
 * User text is never logged (privacy requirement).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SiteReviewService {

    private static final int MIN_COMMENT = 10;
    private static final int MAX_COMMENT = 1000;
    private static final int MAX_TITLE = 120;
    private static final int MAX_PAGE_SIZE = 100;

    private final SiteReviewRepository siteReviewRepository;
    private final AuditLogService auditLogService;
    private final ProfileCompletionGuard profileCompletionGuard;

    /** The signed-in user's own review, or null when they have not written one yet. */
    public SiteReviewResponse getCurrentReview(User user) {
        return siteReviewRepository.findByUserId(user.getId()).map(SiteReviewResponse::from).orElse(null);
    }

    @Transactional
    public SiteReviewResponse create(User user, CreateSiteReviewRequest request) {
        guardEligible(user);
        if (siteReviewRepository.existsByUserId(user.getId())) {
            throw new ApiClientException(
                    HttpStatus.CONFLICT,
                    "SITE_REVIEW_EXISTS",
                    "You have already submitted a review. Use Edit to change it.",
                    false);
        }
        SiteReview review = new SiteReview();
        review.setUser(user);
        applyContent(review, request);
        review.setStatus(SiteReviewStatus.PENDING);
        review.setAdminNote(null);
        SiteReview saved = siteReviewRepository.save(review);
        log.info("Site review created: id={} userId={}", saved.getId(), user.getId());
        return SiteReviewResponse.from(saved);
    }

    @Transactional
    public SiteReviewResponse update(User user, CreateSiteReviewRequest request) {
        guardEligible(user);
        SiteReview review = siteReviewRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("You have not submitted a review yet"));
        applyContent(review, request);
        // Edited reviews go back through moderation before they can be shown publicly.
        review.setStatus(SiteReviewStatus.PENDING);
        review.setAdminNote(null);
        SiteReview saved = siteReviewRepository.save(review);
        log.info("Site review updated: id={} userId={}", saved.getId(), user.getId());
        return SiteReviewResponse.from(saved);
    }

    @Transactional
    public void delete(User user) {
        guardEligible(user);
        SiteReview review = siteReviewRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("You have not submitted a review yet"));
        siteReviewRepository.delete(review);
        log.info("Site review deleted: id={} userId={}", review.getId(), user.getId());
    }

    /* ── Admin moderation ─────────────────────────────────────────── */

    public Page<SiteReviewAdminResponse> adminList(SiteReviewStatus status, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<SiteReview> reviews = status == null
                ? siteReviewRepository.findAll(pageable)
                : siteReviewRepository.findByStatus(status, pageable);
        return reviews.map(SiteReviewAdminResponse::from);
    }

    @Transactional
    public SiteReviewResponse adminApprove(User admin, Long id, String adminNote) {
        return decide(admin, id, SiteReviewStatus.APPROVED, adminNote);
    }

    @Transactional
    public SiteReviewResponse adminReject(User admin, Long id, String adminNote) {
        return decide(admin, id, SiteReviewStatus.REJECTED, adminNote);
    }

    private SiteReviewResponse decide(User admin, Long id, SiteReviewStatus status, String adminNote) {
        SiteReview review = siteReviewRepository.findById(id)
                .orElseThrow(() -> new ApiClientException(
                        HttpStatus.NOT_FOUND, "SITE_REVIEW_NOT_FOUND", "Site review not found", false));
        review.setStatus(status);
        review.setAdminNote(normalizeAdminNote(adminNote));
        SiteReview saved = siteReviewRepository.save(review);
        auditLogService.logAdmin(
                admin,
                status == SiteReviewStatus.APPROVED ? "APPROVE_SITE_REVIEW" : "REJECT_SITE_REVIEW",
                "SiteReview",
                saved.getId(),
                "Site review " + (status == SiteReviewStatus.APPROVED ? "approved" : "rejected"));
        log.info("Site review {}: id={} adminId={}", status, saved.getId(), admin.getId());
        return SiteReviewResponse.from(saved);
    }

    /* ── Helpers ──────────────────────────────────────────────────── */

    /** Completing the profile is a prerequisite; admins can never publish their own praise. */
    private void guardEligible(User user) {
        if (user.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admin accounts cannot submit site reviews");
        }
        profileCompletionGuard.requireProfileCompleted(
                user, "Please complete your profile before sharing a review.");
    }

    private void applyContent(SiteReview review, CreateSiteReviewRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Review body is required");
        }
        Integer rating = request.rating();
        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }
        String comment = ChatInputSanitizer.sanitize(request.comment());
        if (comment.length() < MIN_COMMENT || comment.length() > MAX_COMMENT) {
            throw new IllegalArgumentException(
                    "Comment must be between " + MIN_COMMENT + " and " + MAX_COMMENT + " characters");
        }
        String title = ChatInputSanitizer.sanitize(request.title());
        if (title.isEmpty()) {
            title = null;
        } else if (title.length() > MAX_TITLE) {
            throw new IllegalArgumentException("Title must be " + MAX_TITLE + " characters or fewer");
        }
        review.setRating(rating);
        review.setComment(comment);
        review.setTitle(title);
    }

    private String normalizeAdminNote(String note) {
        String cleaned = ChatInputSanitizer.sanitize(note);
        if (cleaned.isEmpty()) {
            return null;
        }
        return cleaned.length() > 500 ? cleaned.substring(0, 500) : cleaned;
    }

    /** Used by TestimonialsService to merge approved site reviews into the public list. */
    public List<SiteReview> latestApprovedWithUser(int limit) {
        if (limit <= 0) {
            return List.of();
        }
        return siteReviewRepository.findByStatusWithUser(SiteReviewStatus.APPROVED, PageRequest.of(0, limit));
    }
}
