package com.mentorly.files;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@code StoredFile} persistence.
 */
public interface StoredFileRepository extends JpaRepository<StoredFile, Long> {

    Optional<StoredFile> findByStoredName(String storedName);

    List<StoredFile> findByExpiresAtBefore(OffsetDateTime cutoff);

    @Modifying
    @Query("DELETE FROM StoredFile sf WHERE sf.expiresAt IS NOT NULL AND sf.expiresAt < :cutoff")
    int deleteExpired(@Param("cutoff") OffsetDateTime cutoff);
}
