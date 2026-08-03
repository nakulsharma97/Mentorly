package com.skillswap.mentorcertification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@code MentorCertification} persistence.
 */
public interface MentorCertificationRepository extends JpaRepository<MentorCertification, Long> {

    List<MentorCertification> findByMentorIdOrderByIssueDateDesc(Long mentorId);
}
