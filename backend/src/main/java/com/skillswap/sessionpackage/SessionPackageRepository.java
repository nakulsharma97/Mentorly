package com.skillswap.sessionpackage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionPackageRepository extends JpaRepository<SessionPackage, Long> {
    List<SessionPackage> findByMentorId(Long mentorId);
}
