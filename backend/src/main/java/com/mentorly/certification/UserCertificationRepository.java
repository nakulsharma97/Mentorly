package com.mentorly.certification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@code UserCertification} persistence.
 */
public interface UserCertificationRepository extends JpaRepository<UserCertification, Long> {
    List<UserCertification> findByUserIdOrderByIssuedAtDesc(Long userId);

    Page<UserCertification> findByUserIdOrderByIssuedAtDesc(Long userId, Pageable pageable);

    boolean existsByUserIdAndCode(Long userId, String code);
}
