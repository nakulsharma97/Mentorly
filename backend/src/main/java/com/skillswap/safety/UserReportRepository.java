package com.skillswap.safety;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserReportRepository extends JpaRepository<UserReport, Long> {
    List<UserReport> findByReporterIdOrderByCreatedAtDesc(Long reporterId);

    List<UserReport> findByStatusOrderByCreatedAtAsc(ReportStatus status);
}
