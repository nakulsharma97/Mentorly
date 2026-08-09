package com.skillswap.files;

import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.common.exception.ResourceNotFoundException;
import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import com.skillswap.common.SchedulerLockService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Owns the access rules for uploaded files:
 *
 * <ul>
 *   <li>Every upload is recorded ({@link StoredFile}) with its owner and — for
 *       chat attachments — the booking or direct conversation it belongs to.</li>
 *   <li>Downloads are authorized: the owner, an {@code ADMIN}, or a participant
 *       of the referenced booking / direct conversation may fetch the file;
 *       anyone else gets {@link UnauthorizedException} (403).</li>
 *   <li>Files expire after {@code app.files.expiration-days} and are purged
 *       from disk + DB by the nightly cleanup job.</li>
 * </ul>
 */
/**
 * Service implementing stored file business logic.
 */
@Service
@RequiredArgsConstructor
public class StoredFileService {

    private static final Logger LOG = LoggerFactory.getLogger(StoredFileService.class);

    public static final String CONTEXT_BOOKING_CHAT = "BOOKING_CHAT";
    public static final String CONTEXT_DIRECT_CHAT = "DIRECT_CHAT";

    private final StoredFileRepository storedFileRepository;
    private final BookingRepository bookingRepository;
    private final DirectConversationRepository directConversationRepository;
    private final SchedulerLockService schedulerLockService;

    @Value("${app.files.expiration-days:30}")
    private int expirationDays;

    /**
     * Registers an uploaded file's metadata. The on-disk UUID filename is kept;
     * only the metadata row is created here.
     */
    @Transactional
    public StoredFile register(String storedName, String originalName, String contentType,
            long sizeBytes, Long ownerId, String contextType, Long contextId) {
        StoredFile file = new StoredFile();
        file.setStoredName(storedName);
        file.setOriginalName(originalName);
        file.setContentType(contentType);
        file.setSizeBytes(sizeBytes);
        file.setOwnerId(ownerId);
        file.setContextType(contextType);
        file.setContextId(contextId);
        file.setCreatedAt(OffsetDateTime.now());
        file.setExpiresAt(OffsetDateTime.now().plusDays(expirationDays));
        return storedFileRepository.save(file);
    }

    /**
     * Validates that the current user is allowed to attach a file to the given
     * chat context BEFORE the bytes are stored. When a context is claimed
     * (BOOKING_CHAT or DIRECT_CHAT), the uploader must be a participant of
     * that booking / direct conversation — otherwise anyone could plant files
     * into conversations they do not belong to, and the on-disk bytes would
     * already exist before a download-side check could stop them.
     *
     * <p>Standalone uploads (no context) are always allowed. Unknown context
     * types are rejected with {@link IllegalArgumentException} (400), missing
     * or unknown contexts with {@link ResourceNotFoundException} (404), and
     * non-participants with {@link UnauthorizedException} (403). Admins are
     * exempt (they can already download any file, so they may attach to any
     * context too — matching the download-side rule in {@link #loadAuthorized}).
     */
    @Transactional(readOnly = true)
    public void validateUploadContext(String contextType, Long contextId, User currentUser) {
        if (contextType == null || contextType.isBlank()) {
            // Standalone upload (no chat context) — always allowed.
            return;
        }
        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (contextId == null) {
            throw new IllegalArgumentException("contextId is required when a chat context is provided");
        }

        // Admins may attach into any context, mirroring their download access.
        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }

        if (CONTEXT_BOOKING_CHAT.equals(contextType)) {
            Booking booking = bookingRepository.findById(contextId)
                    .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
            boolean isLearner = booking.getLearner() != null
                    && currentUser.getId().equals(booking.getLearner().getId());
            boolean isMentor = booking.getSession() != null
                    && booking.getSession().getMentor() != null
                    && currentUser.getId().equals(booking.getSession().getMentor().getId());
            if (isLearner || isMentor) {
                return;
            }
            throw new UnauthorizedException("You are not a participant of this booking chat");
        }

        if (CONTEXT_DIRECT_CHAT.equals(contextType)) {
            DirectConversation conversation = directConversationRepository
                    .findById(contextId)
                    .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
            boolean isParticipant = (conversation.getParticipantOne() != null
                    && currentUser.getId().equals(conversation.getParticipantOne().getId()))
                    || (conversation.getParticipantTwo() != null
                            && currentUser.getId().equals(conversation.getParticipantTwo().getId()));
            if (isParticipant) {
                return;
            }
            throw new UnauthorizedException("You are not a participant of this conversation");
        }

        throw new IllegalArgumentException("Unsupported chat context: " + contextType);
    }

    /**
     * Loads a stored file by id AND validates the requesting user may access
     * it. Throws {@link ResourceNotFoundException} (404) when the file does
     * not exist or has expired, and {@link UnauthorizedException} (403) when
     * the caller is not authorized.
     */
    @Transactional(readOnly = true)
    public StoredFile loadAuthorized(Long fileId, User currentUser) {
        StoredFile file = storedFileRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));

        if (file.getExpiresAt() != null && OffsetDateTime.now().isAfter(file.getExpiresAt())) {
            // Treat expired files as gone — never leak that a file existed.
            throw new ResourceNotFoundException("File not found");
        }

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }

        // Owner always has access.
        if (currentUser.getId().equals(file.getOwnerId())) {
            return file;
        }

        // Admins can access any file (moderation / support).
        if (currentUser.getRole() == UserRole.ADMIN) {
            return file;
        }

        // Chat participants of the referenced booking / conversation may view
        // the attachments shared in that conversation.
        if (CONTEXT_BOOKING_CHAT.equals(file.getContextType()) && file.getContextId() != null) {
            Booking booking = bookingRepository.findById(file.getContextId()).orElse(null);
            boolean isLearner = booking != null && booking.getLearner() != null
                    && currentUser.getId().equals(booking.getLearner().getId());
            boolean isMentor = booking != null && booking.getSession() != null
                    && booking.getSession().getMentor() != null
                    && currentUser.getId().equals(booking.getSession().getMentor().getId());
            if (isLearner || isMentor) {
                return file;
            }
        } else if (CONTEXT_DIRECT_CHAT.equals(file.getContextType()) && file.getContextId() != null) {
            DirectConversation conversation = directConversationRepository
                    .findById(file.getContextId()).orElse(null);
            boolean isParticipant = conversation != null
                    && (currentUser.getId().equals(conversation.getParticipantOne().getId())
                            || currentUser.getId().equals(conversation.getParticipantTwo().getId()));
            if (isParticipant) {
                return file;
            }
        }

        throw new UnauthorizedException("You do not have access to this file");
    }

    /** Resolves the on-disk path for a stored file (uploads/chat/<uuid>.<ext>). */
    public Path resolvePath(StoredFile file) {
        return Paths.get("uploads", "chat", file.getStoredName());
    }

    /**
     * Nightly purge of expired files: deletes the on-disk bytes first, then
     * removes the DB rows. Failures on individual files are logged and do not
     * abort the sweep.
     */
    @Scheduled(cron = "${app.files.cleanup-cron:0 30 3 * * *}")
    @Transactional
    public void purgeExpired() {
        // Leader lock so only one instance (k8s replica) runs the nightly sweep.
        schedulerLockService.runIfLeader("files-expired-purge", () -> {
            List<StoredFile> expired = storedFileRepository.findByExpiresAtBefore(OffsetDateTime.now());
            if (expired.isEmpty()) {
                return;
            }
            int deletedFiles = 0;
            int deletedRows = 0;
            for (StoredFile file : expired) {
                Path path = resolvePath(file);
                try {
                    boolean removed = Files.deleteIfExists(path);
                    deletedFiles += removed ? 1 : 0;
                } catch (Exception ex) {
                    LOG.warn("Failed to delete expired file on disk: id={}, path={}", file.getId(), path, ex);
                }
                storedFileRepository.delete(file);
                deletedRows++;
            }
            LOG.info("Purged {} expired files ({} rows deleted)", deletedFiles, deletedRows);
        });
    }
}
