package com.skillswap.certification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserCertificationRepository extends JpaRepository<UserCertification, Long> {
    List<UserCertification> findByUserIdOrderByIssuedAtDesc(Long userId);

    boolean existsByUserIdAndCode(Long userId, String code);
}
