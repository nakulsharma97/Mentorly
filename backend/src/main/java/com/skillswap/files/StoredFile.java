package com.skillswap.files;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Metadata record for every uploaded file. Tracks who uploaded the file
 * (owner), which chat context it belongs to (booking or direct conversation),
 * and when it expires — so downloads can be authorized and expired files can
 * be purged. The on-disk filename is the UUID stored in {@link #storedName}.
 */
/**
 * Encapsulates stored file.
 */
@Getter
@Setter
@Entity
@Table(name = "stored_files")
public class StoredFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** UUID-based filename on disk (under uploads/chat/), including extension. */
    @Column(name = "stored_name", nullable = false, unique = true, length = 255)
    private String storedName;

    /** Original client-provided filename, kept for display/download naming only. */
    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;

    @Column(name = "content_type", nullable = false, length = 255)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    /** The uploading user's id — only they (or chat participants/admins) may download. */
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    /** Chat context this attachment belongs to: BOOKING_CHAT or DIRECT_CHAT (null = standalone). */
    @Column(name = "context_type", length = 20)
    private String contextType;

    /** Booking id (BOOKING_CHAT) or conversation id (DIRECT_CHAT). */
    @Column(name = "context_id")
    private Long contextId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    /** Files become inaccessible and are purged after this timestamp. */
    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;
}
